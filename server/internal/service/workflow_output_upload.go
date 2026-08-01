package service

// WorkflowOutputUploadConfig constrains workflow-generated text artifacts to
// the deterministic formats supported by the workflow file capability.
func WorkflowOutputUploadConfig(userID int64) UploadConfig {
	return UploadConfig{
		Type:         UploadType("workflow_output"),
		UserID:       userID,
		MaxSize:      5,
		AllowedExts:  []string{".md", ".json", ".csv"},
		CustomFolder: "",
	}
}
