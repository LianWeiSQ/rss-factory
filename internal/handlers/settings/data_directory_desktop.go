//go:build !server

package settings

import (
	"github.com/LianWeiSQ/rss-factory/internal/handlers/core"
	"github.com/LianWeiSQ/rss-factory/internal/handlers/response"
	"github.com/LianWeiSQ/rss-factory/internal/utils/fileutil"
	"github.com/wailsapp/wails/v3/pkg/application"
	"net/http"
)

func HandleSelectDataDirectory(h *core.Handler, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if !fileutil.DesktopStorageManaged() {
		http.Error(w, "directory controlled by launch configuration", http.StatusConflict)
		return
	}
	app, ok := h.App.(*application.App)
	if !ok {
		w.WriteHeader(http.StatusNotImplemented)
		return
	}
	path, err := app.Dialog.OpenFileWithOptions(&application.OpenFileDialogOptions{Title: "CSS Factory", CanChooseDirectories: true, CanChooseFiles: false}).PromptForSingleSelection()
	if err != nil {
		response.Error(w, err, http.StatusInternalServerError)
		return
	}
	response.JSON(w, map[string]string{"path": path})
}
