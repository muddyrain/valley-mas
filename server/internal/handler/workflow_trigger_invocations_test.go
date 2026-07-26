package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"valley-server/internal/database"
	"valley-server/internal/model"
	"valley-server/internal/workflow"

	"gorm.io/gorm"
)

func publishWorkflowTriggerTestDefinition(t *testing.T, definition model.Workflow) {
	t.Helper()
	if err := database.DB.Transaction(func(tx *gorm.DB) error {
		app, version, err := syncWorkflowAIApp(tx, definition)
		if err != nil {
			return err
		}
		now := time.Now()
		if err := tx.Model(&version).Update("published_at", now).Error; err != nil {
			return err
		}
		return tx.Model(&app).Updates(map[string]any{
			"status": "published", "published_version_id": version.ID,
		}).Error
	}); err != nil {
		t.Fatal(err)
	}
}

func decodeWorkflowTriggerTestResponse(t *testing.T, recorder *httptest.ResponseRecorder) model.WorkflowTrigger {
	t.Helper()
	var envelope struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	var trigger model.WorkflowTrigger
	if err := json.Unmarshal(envelope.Data, &trigger); err != nil {
		t.Fatal(err)
	}
	return trigger
}

func TestWorkflowWebhookSecretAndDeliveryAreEnforced(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	publishWorkflowTriggerTestDefinition(t, definition)

	createRequest := httptest.NewRequest(
		http.MethodPost,
		"/workflows/"+definition.ID.String()+"/triggers",
		bytes.NewBufferString(`{"type":"webhook"}`),
	)
	createRequest.Header.Set("Content-Type", "application/json")
	createRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	createRecorder := httptest.NewRecorder()
	router.ServeHTTP(createRecorder, createRequest)
	if responseCode(createRecorder) != 0 {
		t.Fatalf("create webhook: %s", createRecorder.Body.String())
	}
	trigger := decodeWorkflowTriggerTestResponse(t, createRecorder)
	if trigger.Type != "webhook" || trigger.WebhookSecret == "" || trigger.SecretHash != "" {
		t.Fatalf("unexpected webhook response: %+v", trigger)
	}
	var stored model.WorkflowTrigger
	if err := database.DB.First(&stored, trigger.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.SecretHash == "" || stored.SecretHash == trigger.WebhookSecret {
		t.Fatalf("webhook secret must only be stored as a hash: %+v", stored)
	}

	unauthorized := httptest.NewRequest(
		http.MethodPost,
		"/workflow-hooks/"+trigger.ID.String(),
		bytes.NewBufferString(`{"title":"Valley"}`),
	)
	unauthorized.Header.Set("Authorization", "Bearer wrong")
	unauthorized.Header.Set("X-Valley-Delivery", "delivery-1")
	unauthorizedRecorder := httptest.NewRecorder()
	router.ServeHTTP(unauthorizedRecorder, unauthorized)
	if unauthorizedRecorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthorized webhook: %s", unauthorizedRecorder.Body.String())
	}

	invoke := func() *httptest.ResponseRecorder {
		request := httptest.NewRequest(
			http.MethodPost,
			"/workflow-hooks/"+trigger.ID.String(),
			bytes.NewBufferString(`{"title":"Valley"}`),
		)
		request.Header.Set("Authorization", "Bearer "+trigger.WebhookSecret)
		request.Header.Set("X-Valley-Delivery", "delivery-1")
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, request)
		return recorder
	}
	first := invoke()
	if first.Code != http.StatusAccepted || !strings.Contains(first.Body.String(), `"created":true`) {
		t.Fatalf("first webhook delivery: %s", first.Body.String())
	}
	second := invoke()
	if second.Code != http.StatusAccepted || !strings.Contains(second.Body.String(), `"created":false`) {
		t.Fatalf("duplicate webhook delivery: %s", second.Body.String())
	}
	var count int64
	if err := database.DB.Model(&model.WorkflowRunJob{}).Where("trigger_id = ?", trigger.ID).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected one durable job, got %d", count)
	}

	runWorkflowTriggerWorkerTick(context.Background(), time.Now())
	var job model.WorkflowRunJob
	if err := database.DB.Where("trigger_id = ?", trigger.ID).First(&job).Error; err != nil {
		t.Fatal(err)
	}
	if job.Status != "success" || job.TriggerType != "webhook" {
		t.Fatalf("unexpected webhook job: %+v", job)
	}
	var run model.WorkflowRun
	if err := database.DB.Where("run_job_id = ?", job.ID).First(&run).Error; err != nil {
		t.Fatal(err)
	}
	if run.Status != string(workflow.StatusSucceeded) || !strings.Contains(run.Result, "Valley") {
		t.Fatalf("unexpected webhook run: %+v", run)
	}
}

func TestWorkflowEventIsOwnerScoped(t *testing.T) {
	router, definition := setupWorkflowRuntimeTestRouter(t)
	publishWorkflowTriggerTestDefinition(t, definition)
	createRequest := httptest.NewRequest(
		http.MethodPost,
		"/workflows/"+definition.ID.String()+"/triggers",
		bytes.NewBufferString(`{"type":"event","eventKey":"content.ready"}`),
	)
	createRequest.Header.Set("Content-Type", "application/json")
	createRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	createRecorder := httptest.NewRecorder()
	router.ServeHTTP(createRecorder, createRequest)
	if responseCode(createRecorder) != 0 {
		t.Fatalf("create event trigger: %s", createRecorder.Body.String())
	}

	otherRequest := httptest.NewRequest(
		http.MethodPost,
		"/workflows/events/content.ready",
		bytes.NewBufferString(`{"title":"Other"}`),
	)
	otherRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "202"))
	otherRequest.Header.Set("X-Valley-Delivery", "event-1")
	otherRecorder := httptest.NewRecorder()
	router.ServeHTTP(otherRecorder, otherRequest)
	if responseCode(otherRecorder) != http.StatusNotFound {
		t.Fatalf("other owner must not publish this subscription: %s", otherRecorder.Body.String())
	}

	ownerRequest := httptest.NewRequest(
		http.MethodPost,
		"/workflows/events/content.ready",
		bytes.NewBufferString(`{"title":"Owner"}`),
	)
	ownerRequest.Header.Set("Authorization", workflowRuntimeAuthHeader(t, "101"))
	ownerRequest.Header.Set("X-Valley-Delivery", "event-1")
	ownerRecorder := httptest.NewRecorder()
	router.ServeHTTP(ownerRecorder, ownerRequest)
	if ownerRecorder.Code != http.StatusAccepted || !strings.Contains(ownerRecorder.Body.String(), `"createdCount":1`) {
		t.Fatalf("owner event publish: %s", ownerRecorder.Body.String())
	}
}
