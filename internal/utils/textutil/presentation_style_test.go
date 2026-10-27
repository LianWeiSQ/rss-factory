package textutil

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/PuerkitoBio/goquery"
)

func TestSanitizePresentationStyleSharedVectors(t *testing.T) {
	data, err := os.ReadFile("testdata/presentation_styles.json")
	if err != nil {
		t.Fatal(err)
	}
	var tests []struct {
		Input    string `json:"input"`
		Expected string `json:"expected"`
	}
	if err := json.Unmarshal(data, &tests); err != nil {
		t.Fatal(err)
	}
	if len(tests) < 50 {
		t.Fatal("shared CSS policy vectors unexpectedly missing")
	}
	for i, test := range tests {
		t.Run(fmt.Sprintf("%02d", i), func(t *testing.T) {
			got := SanitizePresentationStyle(test.Input)
			if got != test.Expected {
				t.Errorf("SanitizePresentationStyle(%q) = %q, want %q", test.Input, got, test.Expected)
			}
			if again := SanitizePresentationStyle(got); again != got {
				t.Errorf("style sanitizer is not idempotent: %q -> %q", got, again)
			}
		})
	}
}

func TestNormalizeSourceRetainsPresentationUntilRenderBoundary(t *testing.T) {
	input := `<style>p { color: blue }</style><p style="color:#0f59a4;font-size:15px;position:fixed" align="center" onclick="evil()">正文<br--><img data-src="/source.jpg" style="display:block;width:63px;height:auto"></p><script>
evil()
</script>`
	stored := NormalizeArticleSourceHTML(input)
	for _, want := range []string{`style="color:#0f59a4;font-size:15px;position:fixed"`, `data-src="/source.jpg"`, `align="center"`, "<br/>", "正文"} {
		if !strings.Contains(stored, want) {
			t.Errorf("source metadata lost %q: %s", want, stored)
		}
	}
	for _, bad := range []string{"<style", "<script", "evil()\n"} {
		if strings.Contains(stored, bad) {
			t.Errorf("active container retained %q: %s", bad, stored)
		}
	}
	if strings.Contains(CleanHTML(input), "style=") {
		t.Error("CleanHTML legacy style stripping changed")
	}
	rendered := PrepareArticleContent(stored, "https://example.org/news/article")
	for _, want := range []string{`style="text-align:center;color:#0f59a4;font-size:15px"`, `style="display:block;width:63px;height:auto"`, `src="https://example.org/source.jpg"`, `referrerpolicy="no-referrer"`} {
		if !strings.Contains(rendered, want) {
			t.Errorf("safe source presentation lost %q: %s", want, rendered)
		}
	}
	for _, bad := range []string{"position", "onclick", "data-src", "align="} {
		if strings.Contains(rendered, bad) {
			t.Errorf("render boundary retained %q: %s", bad, rendered)
		}
	}
	if again := PrepareArticleContent(rendered, "https://example.org/news/article"); again != rendered {
		t.Errorf("HTML sanitation is not idempotent: %s -> %s", rendered, again)
	}
	markdown := "# Heading\n\nKeep **Markdown** before render."
	if got := NormalizeArticleSourceHTML(markdown); got != markdown {
		t.Errorf("non-HTML source changed: %q", got)
	}
}

func TestArticleLegacyPresentationIsValidatedIndependently(t *testing.T) {
	content := `<p align="CENTER" style="text-align:left;font-size:15px"><font color="#0F59A4" size="5" face="Untrusted font">正文</font></p><font color="red;position:fixed" size="7;display:none" face="x">safe</font><p align="center;color:red">safe</p>`
	got := PrepareArticleContent(content, "https://example.org")
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(got))
	if err != nil {
		t.Fatal(err)
	}
	if style := doc.Find("p").First().AttrOr("style", ""); style != "text-align:left;font-size:15px" {
		t.Errorf("inline CSS must override legacy presentation: %q", style)
	}
	if style := doc.Find("span").First().AttrOr("style", ""); style != "color:#0f59a4;font-size:24px" {
		t.Errorf("safe font attributes not normalized: %q", style)
	}
	for _, bad := range []string{"<font", "face=", "align=", "size=", "position", "display", "color:red"} {
		if strings.Contains(got, bad) {
			t.Errorf("legacy presentation allowed %q: %s", bad, got)
		}
	}
}

func TestArticlePreservesMathInputMarkersOnly(t *testing.T) {
	got := PrepareArticleContent(`<span class="MathJax fixed">x^2</span>`, "https://example.org")
	if got != `<span class="MathJax">x^2</span>` {
		t.Errorf("math marker lost or utility class retained: %s", got)
	}
}

func TestArticleStyleDoesNotEnableActiveCSSOrParserMutations(t *testing.T) {
	for _, input := range []string{
		`<p style="color:red;position:fixed;inset:0;z-index:99">safe</p>`,
		`<p style="color:expression(alert(1));background:url(https://evil.test/a)">safe</p>`,
		`<p style="color:&#x5c;72 ed">safe</p>`,
		`<p style="color:var(--x);--x:red;filter:url(https://evil.test)">safe</p>`,
		`<p style="color:red;/*x*/background:blue">safe</p>`,
		`<p style="@import 'https://evil.test';color:red">safe</p>`,
		`<p style="font-size:999999px;line-height:0;letter-spacing:-10px;opacity:0;visibility:hidden">safe</p>`,
		`<p style="color:red&#x22; onmouseover=&#x22;alert(1)">safe</p>`,
	} {
		t.Run(input, func(t *testing.T) {
			got := PrepareArticleContent(input, "https://example.org")
			for _, bad := range []string{"position", "inset:", "z-index", "expression", "url(", "var(", "filter", "@import", "999999", "opacity", "visibility", "onmouseover"} {
				if strings.Contains(got, bad) {
					t.Errorf("unsafe %q in %s", bad, got)
				}
			}
			if again := PrepareArticleContent(got, "https://example.org"); again != got {
				t.Errorf("unstable article sanitation: %s -> %s", got, again)
			}
		})
	}
}
