package textutil

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

var markdownBlock = regexp.MustCompile("(?m)^ {0,3}(#{1,6} |```|~~~|[-*+] |[0-9]+\\. |>|\\|.*\\|)")
var rasterDataImage = regexp.MustCompile(`(?i)^data:image/(png|gif|jpeg|webp|avif);base64,[a-z0-9+/=\r\n]+$`)
var htmlElement = regexp.MustCompile(`(?i)<[a-z][a-z0-9]*(?:\s|/?>)`)

// ResolveArticleImageSource selects the first valid HTTP(S) image source.
// Attribute names must be lowercase and values must already be HTML-decoded.
// Inline images are left to the caller, which can preserve the existing src.
func ResolveArticleImageSource(attributes map[string]string, base *url.URL) string {
	for _, key := range []string{"data-src", "data-original", "data-lazy-src", "data-actualsrc", "data-original-src", "zoomfile", "file", "src"} {
		value := strings.TrimSpace(attributes[key])
		if value == "" || strings.HasPrefix(value, "#") {
			continue
		}
		source, err := url.Parse(value)
		if err != nil {
			continue
		}
		if base != nil {
			source = base.ResolveReference(source)
		}
		if (source.Scheme != "http" && source.Scheme != "https") || source.Hostname() == "" {
			continue
		}
		return source.String()
	}
	return ""
}

// PrepareArticleContent renders Markdown sources and normalizes safe reader HTML.
// Existing HTML and pre/code examples remain HTML rather than being reinterpreted.
func PrepareArticleContent(content, baseURL string) string {
	if !htmlElement.MatchString(content) && markdownBlock.MatchString(content) {
		content = RenderMarkdown(content)
	}
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(content))
	if err != nil {
		return ""
	}
	// Drop raw-text and foreign-content containers before serialization. In
	// particular, noscript parses differently in browser templates and must
	// never carry hidden markup through a second parse (GHSA-8q87-xm7v-xv7q).
	doc.Find("script,style,link,meta,base,object,embed,form,input,button,textarea,select,svg,template,noscript,noembed,noframes,plaintext,xmp,title,annotation-xml").Remove()
	normalizeLegacyPresentation(doc)
	doc.Find("*").Each(func(_ int, sel *goquery.Selection) {
		if !safeArticleElements[sel.Get(0).Data] {
			// Preserve text and ordinary descendants in custom feed wrappers.
			sel.ReplaceWithSelection(sel.Contents())
		}
	})
	base, _ := url.Parse(baseURL)
	// Promote lazy image URLs in RSS HTML too, before removing source attributes.
	doc.Find("img").Each(func(_ int, image *goquery.Selection) {
		attributes := make(map[string]string, len(image.Get(0).Attr))
		for _, attr := range image.Get(0).Attr {
			if attr.Namespace == "" {
				attributes[strings.ToLower(attr.Key)] = attr.Val
			}
		}
		if source := ResolveArticleImageSource(attributes, base); source != "" {
			image.SetAttr("src", source)
		}
	})
	doc.Find("*").Each(func(_ int, sel *goquery.Selection) {
		node := sel.Get(0)
		if node.Type != html.ElementNode {
			return
		}
		attrs := make([]html.Attribute, 0, len(node.Attr))
		for _, attr := range node.Attr {
			if attr.Namespace != "" {
				continue
			}
			key := strings.ToLower(attr.Key)
			switch key {
			case "href", "src", "poster":
				if node.Data == "img" && key == "src" && rasterDataImage.MatchString(attr.Val) {
					attrs = append(attrs, attr)
					continue
				}
				value, err := url.Parse(strings.TrimSpace(attr.Val))
				if err != nil {
					continue
				}
				if base != nil {
					value = base.ResolveReference(value)
				}
				if value.Scheme != "http" && value.Scheme != "https" && !(key == "href" && value.Scheme == "mailto") {
					continue
				}
				attr.Val = value.String()
			case "referrerpolicy":
				// Preserve feeds' explicit privacy policy without allowing content
				// to opt into sending more referrer information to image hosts.
				if node.Data != "img" || !strings.EqualFold(strings.TrimSpace(attr.Val), "no-referrer") {
					continue
				}
				attr.Val = "no-referrer"
			case "class":
				allowed := []string{}
				for _, c := range strings.Fields(attr.Val) {
					if strings.HasPrefix(c, "language-") || c == "math" || c == "math-display" || c == "MathJax" {
						allowed = append(allowed, c)
					}
				}
				if len(allowed) == 0 {
					continue
				}
				attr.Val = strings.Join(allowed, " ")
			case "style":
				attr.Val = SanitizePresentationStyle(attr.Val)
				if attr.Val == "" {
					continue
				}
			case "alt", "title", "width", "height", "colspan", "rowspan", "id", "controls", "preload", "type", "data-math":
			default:
				continue
			}
			attrs = append(attrs, attr)
		}
		node.Attr = attrs
		if node.Data == "img" {
			// Reader images must not leak the app origin, even when feeds omit
			// a policy. Hotlink-protected hosts often reject wails.localhost.
			sel.SetAttr("referrerpolicy", "no-referrer")
		}
		if node.Data == "iframe" {
			source, _ := url.Parse(sel.AttrOr("src", ""))
			if source == nil || !allowedEmbedHost(source.Hostname()) {
				sel.Remove()
				return
			}
			sel.SetAttr("sandbox", "allow-scripts allow-same-origin allow-presentation")
			sel.SetAttr("allowfullscreen", "")
		}
	})
	result, _ := doc.Find("body").Html()
	return strings.TrimSpace(result)
}

// NormalizeArticleSourceHTML retains source presentation for the rendering
// boundary while removing active raw-text containers. It does not replace
// PrepareArticleContent, which must still sanitize before exposing the HTML.
func NormalizeArticleSourceHTML(content string) string {
	content = malformedTagRegex.ReplaceAllString(content, "<$1>")
	content = malformedSelfClosingWithAttrs.ReplaceAllString(content, "<$1 $2>")
	content = malformedSelfClosingNoAttrs.ReplaceAllString(content, "<$1>")
	if !htmlElement.MatchString(content) {
		return strings.TrimSpace(content)
	}
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(content))
	if err != nil {
		return ""
	}
	doc.Find("script,style,link,meta,base,object,embed,form,input,button,textarea,select,svg,template,noscript,noembed,noframes,plaintext,xmp,title,annotation-xml").Remove()
	result, _ := doc.Find("body").Html()
	return strings.TrimSpace(result)
}

// Translate obsolete HTML presentation attributes into the same bounded CSS
// policy. Attribute values are validated independently to prevent declarations
// from being injected through a color or alignment attribute.
func normalizeLegacyPresentation(doc *goquery.Document) {
	doc.Find("*").Each(func(_ int, element *goquery.Selection) {
		var legacy []string
		if align, ok := sanitizePresentationValue("text-align", strings.ToLower(strings.TrimSpace(element.AttrOr("align", "")))); ok {
			legacy = append(legacy, "text-align:"+align)
		}
		if element.Get(0).Data == "font" {
			node := element.Get(0)
			node.Data, node.DataAtom = "span", atom.Span
			if color, ok := presentationColor(strings.ToLower(strings.TrimSpace(element.AttrOr("color", "")))); ok {
				legacy = append(legacy, "color:"+color)
			}
			if size := element.AttrOr("size", ""); len(size) == 1 && size[0] >= '1' && size[0] <= '7' {
				legacy = append(legacy, "font-size:"+[]string{"10px", "13px", "16px", "18px", "24px", "32px", "48px"}[size[0]-'1'])
			}
		}
		if len(legacy) > 0 {
			legacy = append(legacy, element.AttrOr("style", ""))
			element.SetAttr("style", SanitizePresentationStyle(strings.Join(legacy, ";")))
		}
	})
}

// Keep the element policy explicit as well as the attribute policy below it.
// MathML is limited to presentation elements; integration points and embedded
// HTML/XML are excluded so reparsing cannot change the security boundary.
var safeArticleElements = func() map[string]bool {
	allowed := make(map[string]bool)
	for _, tag := range strings.Fields(`html head body a abbr address article aside b bdi bdo blockquote br caption cite code col colgroup dd del details dfn div dl dt em figcaption figure footer h1 h2 h3 h4 h5 h6 header hgroup hr i img ins kbd li main mark nav ol p picture pre q rp rt ruby s samp section small source span strong sub summary sup table tbody td tfoot th thead time tr u ul var video audio track iframe math mi mn mo ms mtext mrow mfrac msqrt mroot mstyle merror mpadded mphantom mfenced menclose msub msup msubsup munder mover munderover mmultiscripts mprescripts mtable mtr mtd mspace semantics annotation`) {
		allowed[tag] = true
	}
	return allowed
}()

func allowedEmbedHost(host string) bool {
	for _, allowed := range []string{"youtube.com", "youtube-nocookie.com", "player.vimeo.com", "player.bilibili.com"} {
		if host == allowed || strings.HasSuffix(host, "."+allowed) {
			return true
		}
	}
	return false
}
