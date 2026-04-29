package mindarena

import "testing"

func TestNormalizePersonaCount(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		input int
		want  int
	}{
		{name: "too small", input: 1, want: 5},
		{name: "default edge", input: 3, want: 3},
		{name: "keep five", input: 5, want: 5},
		{name: "clamp six", input: 6, want: 5},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := normalizePersonaCount(tc.input); got != tc.want {
				t.Fatalf("normalizePersonaCount(%d) = %d, want %d", tc.input, got, tc.want)
			}
		})
	}
}
