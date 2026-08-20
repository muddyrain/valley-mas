declare const domainIdBrand: unique symbol;

export type DomainId<Domain extends string> = number & {
  readonly [domainIdBrand]: Domain;
};

export type CommandSequence = DomainId<'command-sequence'>;
export type ResourceId = DomainId<'resource'>;
export type LifeId = DomainId<'life'>;
export type SettlementId = DomainId<'settlement'>;

export function domainId<Domain extends string>(value: number): DomainId<Domain> {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid domain id: ${value}`);
  return value as DomainId<Domain>;
}
