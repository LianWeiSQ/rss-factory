package core

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/LianWeiSQ/rss-factory/internal/cache"
	"github.com/LianWeiSQ/rss-factory/internal/feed"
	"github.com/LianWeiSQ/rss-factory/internal/models"
	"github.com/LianWeiSQ/rss-factory/internal/utils/textutil"
)

func TestArticleContentRefetchCachesSourcePresentation(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		w.Header().Set("Content-Type", "application/rss+xml")
		fmt.Fprint(w, `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>Source feed</title><link>https://example.org</link><description>Test</description><item><title>Styled article</title><link>https://example.org/article</link><content:encoded><![CDATA[<p style="font-size:15px;line-height:28px;color:#0f59a4;position:fixed">Source body</p><script>evil()</script>]]></content:encoded></item></channel></rss>`)
	}))
	defer server.Close()
	// This helper creates a disposable in-memory database, never the user DB.
	h := fullTextHandler(t)
	h.Fetcher = feed.NewFetcher(h.DB)
	t.Cleanup(func() {
		h.Fetcher.GetTaskManager().Stop()
		h.Fetcher.GetCleanupManager().Stop()
	})
	h.ContentCache = cache.NewContentCache(10, 2, time.Minute)
	feedID, err := h.DB.AddFeed(&models.Feed{Title: "Source feed", URL: server.URL})
	if err != nil {
		t.Fatal(err)
	}
	if err := h.DB.SaveArticle(&models.Article{FeedID: feedID, Title: "Styled article", URL: "https://example.org/article", PublishedAt: time.Now()}); err != nil {
		t.Fatal(err)
	}
	var articleID int64
	if err := h.DB.QueryRow("SELECT id FROM articles WHERE feed_id = ?", feedID).Scan(&articleID); err != nil {
		t.Fatal(err)
	}
	content, cached, err := h.GetArticleContentContext(context.Background(), articleID)
	if err != nil || cached {
		t.Fatalf("refetch returned cached=%v, err=%v", cached, err)
	}
	if !strings.Contains(content, `style="font-size:15px;line-height:28px;color:#0f59a4;position:fixed"`) || strings.Contains(content, "<script") {
		t.Fatalf("refetch discarded source styles or retained active tags: %s", content)
	}
	persistent, found, err := h.DB.GetArticleContent(articleID)
	if err != nil || !found || persistent != content {
		t.Fatalf("source presentation not persisted: found=%v err=%v content=%s", found, err, persistent)
	}
	if memory, found := h.ContentCache.Get(articleID); !found || memory != content {
		t.Fatal("memory cache disagrees with persistent source")
	}
	again, cached, err := h.GetArticleContentContext(context.Background(), articleID)
	if err != nil || !cached || again != content || requests.Load() != 1 {
		t.Fatalf("cached request unexpectedly refetched: cached=%v err=%v requests=%d", cached, err, requests.Load())
	}
	rendered := textutil.PrepareArticleContent(content, "https://example.org/article")
	if !strings.Contains(rendered, `style="font-size:15px;line-height:28px;color:#0f59a4"`) || strings.Contains(rendered, "position") {
		t.Fatalf("reader boundary failed on source style: %s", rendered)
	}
}
