package aiclient

import "testing"

func TestExtractJSONObject(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "raw object",
			in:   `{"a":1}`,
			want: `{"a":1}`,
		},
		{
			name: "json fence",
			in:   "```json\n{\"a\":1}\n```",
			want: `{"a":1}`,
		},
		{
			name: "bare fence",
			in:   "```\n{\"a\":1}\n```",
			want: `{"a":1}`,
		},
		{
			name: "nested object",
			in:   "prefix {\"a\":{\"b\":2}} suffix",
			want: `{"a":{"b":2}}`,
		},
		{
			name: "text prefix and suffix",
			in:   "Here is the json:\n{\"x\":\"y\"}\n--end",
			want: `{"x":"y"}`,
		},
		{
			name: "no braces falls back to trim",
			in:   "  no json here  ",
			want: "no json here",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := ExtractJSONObject(c.in)
			if got != c.want {
				t.Fatalf("ExtractJSONObject(%q)=%q want %q", c.in, got, c.want)
			}
		})
	}
}
