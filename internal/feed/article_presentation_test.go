package feed

import (
	"strings"
	"testing"

	"github.com/LianWeiSQ/rss-factory/internal/models"
	"github.com/LianWeiSQ/rss-factory/internal/utils/textutil"
	"github.com/mmcdole/gofeed"
)

func TestProcessArticlesPreservesSourcePresentationForReader(t *testing.T) {
	items := []*gofeed.Item{{
		Title:       "Source presentation",
		Link:        "https://example.org/article",
		Description: `<p style="font-size:20px">Summary</p>`,
		Content:     `<section style="text-align:center"><p style="font-size:40px;color:#0f59a4">05.</p><p style="font-size:15px;line-height:28px;letter-spacing:.5px;position:fixed">正文</p><img src="/ornament.png" style="display:block;width:63px;height:auto"></section><style>body{display:none}</style><script>evil()</script>`,
	}}
	articles := (&Fetcher{}).processArticles(models.Feed{ID: 1, URL: "https://example.org/rss"}, items)
	if len(articles) != 1 {
		t.Fatalf("got %d articles", len(articles))
	}
	stored := articles[0].Content
	if !strings.Contains(stored, `style="font-size:15px;line-height:28px;letter-spacing:.5px;position:fixed"`) {
		t.Errorf("ingestion destroyed source presentation: %s", stored)
	}
	if strings.Contains(stored, "<script") || strings.Contains(stored, "<style") {
		t.Errorf("active source tags retained: %s", stored)
	}
	if strings.Contains(articles[0].Article.OriginalSummary, "style=") {
		t.Error("summary's existing clean HTML behavior changed")
	}
	rendered := textutil.PrepareArticleContent(stored, articles[0].Article.URL)
	for _, want := range []string{`text-align:center`, `font-size:40px;color:#0f59a4`, `font-size:15px;line-height:28px;letter-spacing:0.5px`, `display:block;width:63px;height:auto`} {
		if !strings.Contains(rendered, want) {
			t.Errorf("rendering lost source formatting %q: %s", want, rendered)
		}
	}
	if strings.Contains(rendered, "position") {
		t.Errorf("stored CSS bypassed render policy: %s", rendered)
	}
}
