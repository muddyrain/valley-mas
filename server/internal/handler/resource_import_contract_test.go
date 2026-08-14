package handler

import "testing"

func TestPublicResourceListOrderUsesStableIDTieBreaker(t *testing.T) {
	if got := publicResourceListOrder(""); got != "created_at DESC, id DESC" {
		t.Fatalf("newest order = %q", got)
	}
	if got := publicResourceListOrder("oldest"); got != "created_at ASC, id ASC" {
		t.Fatalf("oldest order = %q", got)
	}
}

func TestResolveUploadResourceLicenseDefaultsToDownloadAllowed(t *testing.T) {
	license, valid := resolveUploadResourceLicense("")
	if !valid || license != "download_allowed" {
		t.Fatalf("empty license = %q, %v", license, valid)
	}
	license, valid = resolveUploadResourceLicense("preview_only")
	if !valid || license != "preview_only" {
		t.Fatalf("preview license = %q, %v", license, valid)
	}
	if _, valid = resolveUploadResourceLicense("unknown"); valid {
		t.Fatal("unknown license should be invalid")
	}
}

func TestNormalizeResourceVisibilityFilter(t *testing.T) {
	for _, visibility := range []string{"private", "shared", "public"} {
		if got := normalizeResourceVisibilityFilter(" " + visibility + " "); got != visibility {
			t.Fatalf("normalizeResourceVisibilityFilter(%q) = %q", visibility, got)
		}
	}
	for _, visibility := range []string{"", "unknown", "PUBLIC"} {
		if got := normalizeResourceVisibilityFilter(visibility); got != "" {
			t.Fatalf("normalizeResourceVisibilityFilter(%q) = %q, want empty", visibility, got)
		}
	}
}
