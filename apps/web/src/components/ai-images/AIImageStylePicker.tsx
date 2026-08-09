import { Check, Search, WandSparkles } from 'lucide-react';
import { useState } from 'react';
import type { AIImageStyleProfile } from '@/api/aiImages';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { groupAIImageStyleProfiles } from './aiImageStyleProfiles';

export function AIImageStylePicker({
  profiles,
  value,
  onValueChange,
  disabled = false,
}: {
  profiles: AIImageStyleProfile[];
  value: AIImageStyleProfile | null;
  onValueChange: (profile: AIImageStyleProfile | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const groups = groupAIImageStyleProfiles(profiles, query);
  const hasMatches = groups.builtin.length > 0 || groups.skill.length > 0;

  const select = (profile: AIImageStyleProfile | null) => {
    onValueChange(profile);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setQuery('');
      }}
    >
      <DialogTrigger
        render={<Button type="button" size="sm" variant="outline" disabled={disabled} />}
      >
        <WandSparkles />
        <span className="max-w-36 truncate">{value ? `风格：${value.name}` : '风格'}</span>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle>选择风格</DialogTitle>
          <DialogDescription>
            内置风格和已安装技能都属于同一项设置，只调整画面的视觉表现。
          </DialogDescription>
        </DialogHeader>
        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="搜索内置风格或已安装技能"
            />
          </div>
        </div>
        <ScrollArea className="max-h-[min(28rem,65vh)]">
          <div className="space-y-4 p-4">
            <StyleOption profile={null} selected={!value} onSelect={() => select(null)} />
            {groups.builtin.length > 0 ? (
              <StyleGroup
                title="内置风格"
                profiles={groups.builtin}
                selectedID={value?.id}
                onSelect={select}
              />
            ) : null}
            {groups.skill.length > 0 ? (
              <StyleGroup
                title="已安装技能"
                profiles={groups.skill}
                selectedID={value?.id}
                onSelect={select}
              />
            ) : null}
            {!hasMatches ? (
              <div className="py-8 text-center">
                <WandSparkles className="mx-auto size-7 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">没有匹配的风格</p>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function StyleGroup({
  title,
  profiles,
  selectedID,
  onSelect,
}: {
  title: string;
  profiles: AIImageStyleProfile[];
  selectedID?: string;
  onSelect: (profile: AIImageStyleProfile) => void;
}) {
  return (
    <section className="space-y-2">
      <p className="px-1 text-xs font-medium text-muted-foreground">{title}</p>
      {profiles.map((profile) => (
        <StyleOption
          key={profile.id}
          profile={profile}
          selected={selectedID === profile.id}
          onSelect={() => onSelect(profile)}
        />
      ))}
    </section>
  );
}

function StyleOption({
  profile,
  selected,
  onSelect,
}: {
  profile: AIImageStyleProfile | null;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      variant={selected ? 'secondary' : 'outline'}
      aria-pressed={selected}
      className="h-auto w-full items-start justify-start px-3 py-2.5 text-left font-normal !whitespace-normal"
      onClick={onSelect}
    >
      <span className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <WandSparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {profile?.name ?? '不指定风格'}
            </span>
            {profile ? (
              <Badge variant="outline" className="shrink-0">
                {profile.source === 'skill' ? '技能' : '内置'}
              </Badge>
            ) : null}
          </span>
          <span className="mt-1 block line-clamp-2 overflow-hidden text-xs leading-5 text-muted-foreground">
            {profile?.description ?? '仅根据描述和参考图自由生成'}
          </span>
        </span>
      </span>
      {selected ? (
        <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-label="已选中" />
      ) : null}
    </Button>
  );
}
