package update

import (
	"os"
	"path/filepath"
	"testing"
)

// Test copyFile function
func TestCopyFile(t *testing.T) {
	// Create a temporary source file
	tmpDir := t.TempDir()
	srcPath := filepath.Join(tmpDir, "source.txt")
	dstPath := filepath.Join(tmpDir, "dest.txt")

	// Write test content
	testContent := []byte("test content")
	if err := os.WriteFile(srcPath, testContent, 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// Test copy
	if err := copyFile(srcPath, dstPath); err != nil {
		t.Fatalf("copyFile failed: %v", err)
	}

	// Verify content
	content, err := os.ReadFile(dstPath)
	if err != nil {
		t.Fatalf("Failed to read destination file: %v", err)
	}

	if string(content) != string(testContent) {
		t.Errorf("Content mismatch: got %s, want %s", content, testContent)
	}
}

func TestPortableUpdateFindsRenamedDistributionBinary(t *testing.T) {
	for _, tc := range []struct {
		name, platform, currentName, want string
		files                             []string
	}{
		{
			name: "macOS renamed app bundle", platform: "darwin", currentName: "CSSFactory",
			files: []string{"KnowledgeHub.app/Contents/MacOS/KnowledgeHub"},
			want:  "KnowledgeHub.app/Contents/MacOS/KnowledgeHub",
		},
		{
			name: "Windows renamed binary ignores case", platform: "windows", currentName: "CSSFactory.exe",
			files: []string{"knowledgehub.exe"}, want: "knowledgehub.exe",
		},
		{
			name: "canonical binary preferred over old binary", platform: "linux", currentName: "CSSFactory",
			files: []string{"CSSFactory", "KnowledgeHub"}, want: "KnowledgeHub",
		},
		{
			name: "older compatible archive", platform: "linux", currentName: "CSSFactory",
			files: []string{"CSSFactory"}, want: "CSSFactory",
		},
		{
			name: "unrelated executable rejected", platform: "linux", currentName: "CSSFactory",
			files: []string{"helper", "KnowledgeHub.exe"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			for _, name := range tc.files {
				path := filepath.Join(dir, filepath.FromSlash(name))
				if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(path, []byte("test executable"), 0700); err != nil {
					t.Fatal(err)
				}
			}
			got, err := findPortableUpdateExecutable(dir, tc.platform, tc.currentName)
			if tc.want == "" {
				if err == nil {
					t.Fatalf("unexpected executable accepted: %s", got)
				}
				return
			}
			if err != nil || got != filepath.Join(dir, filepath.FromSlash(tc.want)) {
				t.Fatalf("findPortableUpdateExecutable = %q, %v; want %q", got, err, tc.want)
			}
		})
	}
}
