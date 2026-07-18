import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getAPIErrorMessage } from '@/api/aiWorkbench';
import { createWorkflow } from '@/api/workflow';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface WorkflowCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkflowCreateDialog({ open, onOpenChange }: WorkflowCreateDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) return;
    setName('');
    setDescription('');
  }, [open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!creating) onOpenChange(nextOpen);
  };

  const create = async () => {
    const normalizedName = name.trim();
    const normalizedDescription = description.trim();
    if (!normalizedName || !normalizedDescription || creating) return;
    try {
      setCreating(true);
      const workflow = await createWorkflow({
        name: normalizedName,
        description: normalizedDescription,
        status: 'draft',
      });
      onOpenChange(false);
      toast.success('工作流已创建');
      navigate(`/workbench/edit?id=${workflow.id}`);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建工作流失败'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <DialogHeader>
            <DialogTitle>创建工作流</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="workflow-name">工作流名称</Label>
                <span className="text-xs text-muted-foreground">{name.length}/30</span>
              </div>
              <Input
                id="workflow-name"
                autoFocus
                required
                maxLength={30}
                value={name}
                placeholder="输入工作流名称"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="workflow-description">工作流描述</Label>
                <span className="text-xs text-muted-foreground">{description.length}/500</span>
              </div>
              <Textarea
                id="workflow-description"
                required
                maxLength={500}
                value={description}
                className="min-h-32 resize-none"
                placeholder="描述这个工作流要完成的任务"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={creating}
              onClick={() => handleOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={creating || !name.trim() || !description.trim()}>
              {creating ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
