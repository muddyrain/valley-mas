import {
  FileText,
  FolderOpen,
  Globe2,
  LockKeyhole,
  type LucideIcon,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { StartInputDefinition, WorkflowStartInputControl } from './types';

interface NamedOption {
  id: string;
  name: string;
}

interface WorkflowRunInputFieldsProps {
  definitions: Record<string, StartInputDefinition>;
  values: Record<string, unknown>;
  files: Record<string, File>;
  tags: readonly NamedOption[];
  groups: readonly NamedOption[];
  loadingOptions: boolean;
  onValueChange: (name: string, value: unknown) => void;
  onFileChange: (name: string, file: File | undefined) => void;
}

const customInputCopy: Record<string, { label: string; placeholder?: string }> = {
  topic: {
    label: '写作主题',
    placeholder: '例如：个人创作者如何建立内容素材库',
  },
  audience: {
    label: '目标读者',
    placeholder: '例如：独立开发者和内容创作者',
  },
  style: {
    label: '风格',
    placeholder: '例如：简洁、专业、科技感',
  },
  generateCover: {
    label: '生成封面',
  },
};

const inputControlCopy: Record<Exclude<WorkflowStartInputControl, 'default'>, { label: string }> = {
  markdown_file: { label: 'Markdown 文件' },
  blog_tags: { label: '博客标签' },
  blog_group: { label: '博客分组' },
  visibility: { label: '可见范围' },
};

function InputLabel({
  children,
  htmlFor,
  required,
}: {
  children: ReactNode;
  htmlFor?: string;
  required: boolean;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="flex items-center gap-2 text-sm font-medium text-foreground"
    >
      <span>
        {children}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      <Badge variant={required ? 'secondary' : 'outline'}>{required ? '必填' : '可选'}</Badge>
    </Label>
  );
}

function RunInputField({
  children,
  className,
  label,
  htmlFor,
  required,
}: {
  children: ReactNode;
  className?: string;
  label: ReactNode;
  htmlFor?: string;
  required: boolean;
}) {
  return (
    <div
      className={cn(
        'space-y-2 rounded-xl border border-border bg-card p-3 shadow-xs transition-[background-color,border-color,box-shadow] duration-200 hover:border-primary/25 focus-within:border-primary/50 focus-within:bg-muted/20 focus-within:ring-2 focus-within:ring-primary/10',
        className,
      )}
    >
      <InputLabel htmlFor={htmlFor} required={required}>
        {label}
      </InputLabel>
      {children}
    </div>
  );
}

function FilePicker({
  accept,
  file,
  inputID,
  label,
  onChange,
}: {
  accept?: string;
  file?: File;
  inputID: string;
  label: string;
  onChange: (file: File | undefined) => void;
}) {
  const [inputKey, setInputKey] = useState(0);
  const helperText = accept ? '支持 .md、.markdown 格式' : '选择一个文件';

  return (
    <div className="rounded-lg border border-dashed border-input bg-muted/20 p-2 transition-colors hover:bg-muted/40">
      <Input
        key={inputKey}
        id={inputID}
        className="sr-only"
        type="file"
        accept={accept}
        onChange={(event) => onChange(event.target.files?.[0])}
      />
      <div className="flex min-h-12 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {file ? <FileText className="size-4" /> : <Upload className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {file?.name || `选择${label}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{file ? '已选择文件' : helperText}</p>
        </div>
        <Label
          htmlFor={inputID}
          className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-accent"
        >
          {file ? '替换' : '选择'}
        </Label>
        {file ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`移除${label}`}
            onClick={() => {
              onChange(undefined);
              setInputKey((current) => current + 1);
            }}
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function OptionValue({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <Icon className="size-3.5 text-muted-foreground" />
      {label}
    </span>
  );
}

function TagPicker({
  name,
  selectedTagIds,
  tags,
  onValueChange,
}: {
  name: string;
  selectedTagIds: string[];
  tags: readonly NamedOption[];
  onValueChange: (name: string, value: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="博客标签">
      {tags.map((tag) => {
        const checked = selectedTagIds.includes(tag.id);
        return (
          <label
            key={tag.id}
            className={cn(
              'flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground transition-[background-color,border-color,color] hover:border-primary/35 hover:bg-muted/50',
              checked && 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15',
            )}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(nextChecked) =>
                onValueChange(
                  name,
                  nextChecked
                    ? [...selectedTagIds, tag.id]
                    : selectedTagIds.filter((id) => id !== tag.id),
                )
              }
            />
            <span>{tag.name}</span>
          </label>
        );
      })}
    </div>
  );
}

export function WorkflowRunInputFields({
  definitions,
  values,
  files,
  tags,
  groups,
  loadingOptions,
  onValueChange,
  onFileChange,
}: WorkflowRunInputFieldsProps) {
  const definitionEntries = Object.entries(definitions);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {definitionEntries.map(([name, definition]) => {
        const inputID = `workflow-input-${name}`;
        const copy = customInputCopy[name];
        const label =
          definition.control === 'default'
            ? copy?.label || name
            : inputControlCopy[definition.control].label;
        const key = definition.id || name;

        if (definition.control === 'markdown_file') {
          return (
            <RunInputField
              key={key}
              className="md:col-span-2"
              label={label}
              htmlFor={inputID}
              required={definition.required}
            >
              <FilePicker
                inputID={inputID}
                label={label}
                accept=".md,.markdown,text/markdown"
                file={files[name]}
                onChange={(file) => onFileChange(name, file)}
              />
            </RunInputField>
          );
        }

        if (definition.provider === 'blog.tags') {
          const selectedTagIds = (values[name] as string[]) || [];
          return (
            <RunInputField
              key={key}
              className="md:col-span-2"
              label={label}
              required={definition.required}
            >
              {loadingOptions ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <TagPicker
                  name={name}
                  selectedTagIds={selectedTagIds}
                  tags={tags}
                  onValueChange={onValueChange}
                />
              )}
            </RunInputField>
          );
        }

        if (definition.provider === 'blog.groups') {
          const selectedGroup = groups.find((group) => group.id === values[name]);
          return (
            <RunInputField key={key} label={label} required={definition.required}>
              <Select
                value={(values[name] as string) || '_none'}
                onValueChange={(groupId) => onValueChange(name, groupId === '_none' ? '' : groupId)}
              >
                <SelectTrigger aria-label={label} className="w-full bg-muted/20 hover:bg-muted/40">
                  <SelectValue placeholder="不指定分组">
                    <OptionValue icon={FolderOpen} label={selectedGroup?.name || '不指定分组'} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="_none">
                    <OptionValue icon={FolderOpen} label="不指定分组" />
                  </SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <OptionValue icon={FolderOpen} label={group.name} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </RunInputField>
          );
        }

        if (definition.provider === 'static.visibility') {
          const visibility = (values[name] as string) || 'private';
          const visibilityOptions = {
            private: { icon: LockKeyhole, label: '私密' },
            shared: { icon: Users, label: '共享' },
            public: { icon: Globe2, label: '公开' },
          } as const;
          const selectedVisibility =
            visibilityOptions[visibility as keyof typeof visibilityOptions] ||
            visibilityOptions.private;

          return (
            <RunInputField key={key} label={label} required={definition.required}>
              <Select
                value={visibility}
                onValueChange={(nextVisibility) => onValueChange(name, nextVisibility)}
              >
                <SelectTrigger aria-label={label} className="w-full bg-muted/20 hover:bg-muted/40">
                  <SelectValue>
                    <OptionValue icon={selectedVisibility.icon} label={selectedVisibility.label} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  {Object.entries(visibilityOptions).map(([value, option]) => (
                    <SelectItem key={value} value={value}>
                      <OptionValue icon={option.icon} label={option.label} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </RunInputField>
          );
        }

        if (definition.type === 'boolean') {
          return (
            <label
              key={key}
              htmlFor={inputID}
              className={cn(
                'flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-xs transition-[background-color,border-color,box-shadow] duration-200 hover:border-primary/25 hover:bg-muted/20 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10',
                values[name] === true && 'border-primary/35 bg-primary/5',
              )}
            >
              <Checkbox
                id={inputID}
                checked={values[name] === true}
                onCheckedChange={(checked) => onValueChange(name, checked === true)}
              />
              <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{label}</span>
              <Badge variant={definition.required ? 'secondary' : 'outline'}>
                {definition.required ? '必填' : '可选'}
              </Badge>
            </label>
          );
        }

        if (definition.type === 'file') {
          return (
            <RunInputField
              key={key}
              className="md:col-span-2"
              label={label}
              htmlFor={inputID}
              required={definition.required}
            >
              <FilePicker
                inputID={inputID}
                label={label}
                file={files[name]}
                onChange={(file) => onFileChange(name, file)}
              />
            </RunInputField>
          );
        }

        return (
          <RunInputField key={key} label={label} htmlFor={inputID} required={definition.required}>
            <Input
              id={inputID}
              className="bg-muted/20 hover:bg-muted/40 focus-visible:bg-background"
              type={definition.type === 'number' ? 'number' : 'text'}
              value={String(values[name] || '')}
              placeholder={
                copy?.placeholder || (definition.type === 'string[]' ? '以逗号分隔' : undefined)
              }
              onChange={(event) => {
                const raw = event.target.value;
                if (definition.type === 'number') {
                  onValueChange(name, raw === '' ? '' : Number(raw));
                } else if (definition.type === 'string[]') {
                  onValueChange(
                    name,
                    raw
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  );
                } else {
                  onValueChange(name, raw);
                }
              }}
            />
          </RunInputField>
        );
      })}
    </div>
  );
}
