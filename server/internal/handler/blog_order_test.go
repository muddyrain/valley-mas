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
