package main

import (
	_ "embed"

	"github.com/LianWeiSQ/rss-factory/internal/advertisement"
	"github.com/LianWeiSQ/rss-factory/internal/handlers/core"
)

//go:embed ads.json
var bundledAds []byte

func configureAdvertisements(h *core.Handler) {
	h.Advertisements = advertisement.New(bundledAds)
}
