package model

import "testing"

func TestGardenTableNames(t *testing.T) {
	cases := []struct{ name, want string }{
		{(&Garden{}).TableName(), "gardens"},
		{(&Plant{}).TableName(), "garden_plants"},
		{(&GrowthLog{}).TableName(), "garden_growth_logs"},
		{(&InteractionLog{}).TableName(), "garden_interaction_logs"},
		{(&Harvest{}).TableName(), "garden_harvests"},
	}
	for _, c := range cases {
		if c.name != c.want {
			t.Fatalf("expected %s, got %s", c.want, c.name)
		}
	}
}
