package tray

import (
	"context"
	"database/sql"
	"errors"
	"testing"
)

type unreadSource struct {
	setting              string
	readerSetting        string
	count                int
	settingErr, countErr error
	countReads           int
}

func (s *unreadSource) GetSettingContext(_ context.Context, key string) (string, error) {
	switch key {
	case "show_tray_unread_count":
		return s.setting, s.settingErr
	case "show_unread_counts":
		return s.readerSetting, nil
	default:
		return "", sql.ErrNoRows
	}
}

func (s *unreadSource) GetTotalUnreadCountContext(context.Context) (int, error) {
	s.countReads++
	return s.count, s.countErr
}

func TestUnreadLabel(t *testing.T) {
	failure := errors.New("database unavailable")
	for _, tc := range []struct {
		name    string
		source  unreadSource
		want    string
		wantErr error
	}{
		{name: "unread", source: unreadSource{setting: "true", count: 42}, want: "42"},
		{name: "zero", source: unreadSource{setting: "true"}},
		{name: "hidden while reader counts enabled", source: unreadSource{setting: "false", readerSetting: "true", count: 42}},
		{name: "shown while reader counts disabled", source: unreadSource{setting: "true", readerSetting: "false", count: 42}, want: "42"},
		{name: "legacy default hidden", source: unreadSource{settingErr: sql.ErrNoRows, count: 8}},
		{name: "setting failure", source: unreadSource{settingErr: failure}, wantErr: failure},
		{name: "count failure", source: unreadSource{setting: "true", countErr: failure}, wantErr: failure},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := UnreadLabel(context.Background(), &tc.source)
			if got != tc.want || !errors.Is(err, tc.wantErr) {
				t.Fatalf("UnreadLabel = %q, %v; want %q, %v", got, err, tc.want, tc.wantErr)
			}
			if tc.source.setting != "true" && tc.source.countReads != 0 {
				t.Fatal("hidden indicator queried article counts")
			}
		})
	}
}

func TestWatchUnreadStopsOnCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	source := &unreadSource{setting: "true", count: 7}
	calls := 0
	WatchUnread(ctx, source, func(label string) {
		calls++
		if label != "7" {
			t.Errorf("label = %q", label)
		}
		cancel()
	})
	if calls != 1 || source.countReads != 1 {
		t.Fatalf("unexpected updates: %d, reads: %d", calls, source.countReads)
	}
}
