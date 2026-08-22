package handler

import "testing"

func TestBuildPostTimelineOrderExprUsesStableTiebreakers(t *testing.T) {
	testCases := []struct {
		name string
		sort string
		want string
	}{
		{
			name: "newest",
			want: "is_top DESC, COALESCE(published_at, created_at) DESC, created_at DESC, id DESC",
		},
		{
			name: "oldest",
			sort: "oldest",
			want: "is_top DESC, COALESCE(published_at, created_at) ASC, created_at ASC, id ASC",
		},
		{
			name: "created",
			sort: "created",
			want: "is_top DESC, created_at DESC, id DESC",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := buildPostTimelineOrderExpr(testCase.sort); got != testCase.want {
				t.Fatalf("buildPostTimelineOrderExpr(%q) = %q, want %q", testCase.sort, got, testCase.want)
			}
		})
	}
}

func TestBuildAdminPostListOrderExprSupportsCreatedSort(t *testing.T) {
	gotCreated := buildAdminPostListOrderExpr("created")
	if gotCreated != "is_top DESC, created_at DESC, id DESC" {
		t.Fatalf("buildAdminPostListOrderExpr(%q) = %q, want %q", "created", gotCreated, "is_top DESC, created_at DESC, id DESC")
	}

	gotCreatedUpper := buildAdminPostListOrderExpr("CREATED")
	if gotCreatedUpper != "is_top DESC, created_at DESC, id DESC" {
		t.Fatalf("buildAdminPostListOrderExpr(%q) = %q, want %q", "CREATED", gotCreatedUpper, "is_top DESC, created_at DESC, id DESC")
	}

	gotDefault := buildAdminPostListOrderExpr("")
	wantDefault := buildPostTimelineOrderExpr("")
	if gotDefault != wantDefault {
		t.Fatalf("buildAdminPostListOrderExpr(%q) = %q, want %q", "", gotDefault, wantDefault)
	}
}

func TestBuildPostCoverThumbnailURL(t *testing.T) {
	const process = "x-tos-process=image/resize,w_800,m_lfit/format,webp/quality,q_85"

	testCases := []struct {
		name       string
		coverURL   string
		storageKey string
		want       string
	}{
		{
			name:       "stored cover gets a compact webp variant",
			coverURL:   "https://tos.example.com/blog/cover.png",
			storageKey: "blog/cover.png",
			want:       "https://tos.example.com/blog/cover.png?" + process,
		},
		{
			name:       "stored cover preserves an existing query",
			coverURL:   "https://tos.example.com/blog/cover.png?token=abc",
			storageKey: "blog/cover.png",
			want:       "https://tos.example.com/blog/cover.png?token=abc&" + process,
		},
		{
			name:     "external cover remains unchanged",
			coverURL: "https://images.example.com/cover.png",
			want:     "https://images.example.com/cover.png",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			if got := buildPostCoverThumbnailURL(testCase.coverURL, testCase.storageKey); got != testCase.want {
				t.Fatalf("buildPostCoverThumbnailURL() = %q, want %q", got, testCase.want)
			}
		})
	}
}
