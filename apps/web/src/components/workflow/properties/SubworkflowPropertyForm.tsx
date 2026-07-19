import { useEffect, useMemo, useState } from 'react';
import {
  getWorkflowPlatform,
  type WorkflowPlatformData,
  type WorkflowVersion,
} from '@/api/workflow';
import { EditorSection } from '@/components/ai-workbench/EditorSection';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  compareSubworkflowContracts,
  normalizeSubworkflowSchema,
  type PublishedWorkflowContract,
  publishedWorkflowContract,
  type SubworkflowContractIssue,
} from '../subworkflowContract';
import { VariableValueEditor } from '../VariableReferencePicker';
import type { PropertyFormProps } from './index';

function versionLabel(version: WorkflowVersion) {
  return `v${version.number}`;
}

function publishedVersions(platform: WorkflowPlatformData | null) {
  if (!platform) return [];
  return platform.versions.filter(
    (version) => version.publishedAt || version.id === platform.app.publishedVersionId,
  );
}

function issueLabel(issue: SubworkflowContractIssue) {
  const scope = issue.scope === 'input' ? '输入' : '输出';
  if (issue.reason === 'required_added') return `新增必填${scope}「${issue.name}」`;
  return `${scope}「${issue.name}」${issue.reason === 'removed' ? '已移除' : '类型已变更'}`;
}

function selectedContract(
  config: Record<string, unknown>,
  version?: WorkflowVersion,
): PublishedWorkflowContract {
  const inputSchema = normalizeSubworkflowSchema(config.inputSchema);
  const outputSchema = normalizeSubworkflowSchema(config.outputSchema);
  if (Object.keys(inputSchema).length || Object.keys(outputSchema).length) {
    return { inputSchema, outputSchema, requiredInputs: [] };
  }
  return publishedWorkflowContract(version?.config || '');
}

function PublishedWorkflowSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-9" />
        </div>
        <Skeleton className="h-3 w-5/6" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-12" />
        </div>
      </div>
    </div>
  );
}

export function SubworkflowPropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  const workflowID = String(config.workflowId || '');
  const versionID = String(config.versionId || '');
  const inputs = (config.inputs as Record<string, unknown>) || {};
  const [platform, setPlatform] = useState<WorkflowPlatformData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingPlatform, setIsLoadingPlatform] = useState(Boolean(workflowID));
  const [targetVersionID, setTargetVersionID] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!workflowID) {
      setPlatform(null);
      setLoadError(null);
      setIsLoadingPlatform(false);
      return;
    }
    let active = true;
    setPlatform(null);
    setLoadError(null);
    setIsLoadingPlatform(true);
    void getWorkflowPlatform(workflowID)
      .then((result) => {
        if (!active) return;
        setPlatform(result);
        const versions = publishedVersions(result);
        const latest = versions.reduce<WorkflowVersion | undefined>(
          (current, version) => (!current || version.number > current.number ? version : current),
          undefined,
        );
        setTargetVersionID(latest?.id || versionID);
      })
      .catch(() => {
        if (active) setLoadError('无法加载可用版本');
      })
      .finally(() => {
        if (active) setIsLoadingPlatform(false);
      });
    return () => {
      active = false;
    };
  }, [versionID, workflowID]);

  const versions = useMemo(() => publishedVersions(platform), [platform]);
  const versionSelectItems = useMemo(
    () => versions.map((version) => ({ value: version.id, label: versionLabel(version) })),
    [versions],
  );
  const currentVersion = versions.find((version) => version.id === versionID);
  const targetVersion = versions.find((version) => version.id === targetVersionID);
  const currentContract = selectedContract(config, currentVersion);
  const targetContract = targetVersion ? publishedWorkflowContract(targetVersion.config) : null;
  const issues = targetContract ? compareSubworkflowContracts(currentContract, targetContract) : [];
  const isDifferentVersion = Boolean(targetVersion && targetVersion.id !== versionID);

  const applyVersion = () => {
    if (!targetVersion || !targetContract) return;
    const nextInputs = Object.fromEntries(
      Object.keys(targetContract.inputSchema).map((name) => [name, inputs[name] ?? '']),
    );
    onUpdateConfig({
      versionId: targetVersion.id,
      versionNumber: targetVersion.number,
      versionPublishedAt: targetVersion.publishedAt,
      inputs: nextInputs,
      inputSchema: targetContract.inputSchema,
      outputSchema: targetContract.outputSchema,
    });
    setShowConfirm(false);
  };

  const requestVersionChange = () => {
    if (!isDifferentVersion) return;
    if (issues.length) {
      setShowConfirm(true);
      return;
    }
    applyVersion();
  };

  return (
    <>
      <EditorSection title="已发布工作流" description="节点始终锁定一个已发布版本。">
        <div className="space-y-2">
          <Label>工作流</Label>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            {String(config.workflowName || config.workflowId || '未选择')}
          </div>
        </div>
        <div className="min-h-36">
          {isLoadingPlatform ? (
            <PublishedWorkflowSkeleton />
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>已锁定版本</Label>
                  {currentVersion ? (
                    <Badge variant="outline">{versionLabel(currentVersion)}</Badge>
                  ) : null}
                </div>
                {currentVersion ? (
                  <p className="text-xs text-muted-foreground">
                    已发布版本不会随子工作流的后续修改自动改变。
                  </p>
                ) : (
                  <p className="text-xs text-destructive">当前版本不可用，请选择一个已发布版本。</p>
                )}
              </div>
              {versions.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <Label>切换版本</Label>
                  <div className="flex gap-2">
                    <Select
                      items={versionSelectItems}
                      value={targetVersionID}
                      onValueChange={(value) => setTargetVersionID(value || '')}
                    >
                      <SelectTrigger className="min-w-0 flex-1">
                        <SelectValue placeholder="选择已发布版本" />
                      </SelectTrigger>
                      <SelectContent side="bottom" align="start" alignItemWithTrigger={false}>
                        {versions.map((version) => (
                          <SelectItem key={version.id} value={version.id}>
                            {versionLabel(version)}
                            {version.id === versionID ? '（当前）' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={requestVersionChange}
                      disabled={!isDifferentVersion}
                    >
                      {issues.length ? '检查并更新' : '更新'}
                    </Button>
                  </div>
                  {isDifferentVersion && issues.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      可直接更新，现有输入和输出字段保持兼容。
                    </p>
                  ) : null}
                  {isDifferentVersion && issues.length > 0 ? (
                    <p className="text-xs text-destructive">
                      新版本有 {issues.length} 项字段变化，需要确认映射。
                    </p>
                  ) : null}
                </div>
              ) : null}
              {loadError ? <p className="mt-4 text-xs text-destructive">{loadError}</p> : null}
            </>
          )}
        </div>
        {Object.entries(inputs).map(([name, value]) => (
          <div key={name} className="space-y-1.5">
            <Label>{name}</Label>
            <VariableValueEditor
              ariaLabel={`${name} 输入值`}
              value={String(value ?? '')}
              onChange={(nextValue) => onUpdateConfig({ inputs: { ...inputs, [name]: nextValue } })}
              options={variableOptions}
              fixedPlaceholder={`输入 ${name} 的固定值`}
            />
          </div>
        ))}
      </EditorSection>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              更新到 {targetVersion ? versionLabel(targetVersion) : '新版本'}？
            </AlertDialogTitle>
            <AlertDialogDescription>
              更新后，请检查受影响的变量映射再保存工作流。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {issues.map((issue) => (
              <li key={`${issue.scope}:${issue.name}:${issue.reason}`}>• {issueLabel(issue)}</li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={applyVersion}>更新版本</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
