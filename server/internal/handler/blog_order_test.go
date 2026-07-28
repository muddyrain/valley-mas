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
