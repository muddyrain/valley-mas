import { WorkflowIOField } from './WorkflowIOField';

interface WorkflowOutputFieldListProps {
  outputs: ReadonlyArray<readonly [string, string]>;
  labels?: Record<string, string>;
  descriptions?: Record<string, string>;
}

export function WorkflowOutputFieldList({
  outputs,
  labels = {},
  descriptions = {},
}: WorkflowOutputFieldListProps) {
  return (
    <div className="space-y-2">
      {outputs.map(([name, type]) => {
        return (
          <WorkflowIOField
            key={name}
            name={name}
            label={labels[name]}
            type={type}
            description={descriptions[name]}
          />
        );
      })}
    </div>
  );
}
