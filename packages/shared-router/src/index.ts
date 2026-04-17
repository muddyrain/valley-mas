import { useCallback } from 'react';
import type { NavigateOptions } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';

export type UrlQueryParamConfig<T> = {
  defaultValue: T;
  parse?: (raw: string | null) => T;
  serialize?: (value: T) => string | null;
  equals?: (a: T, b: T) => boolean;
  resetPageOnChange?: boolean;
};

type UrlQueryStateSchema = Record<string, UrlQueryParamConfig<any>>;

type InferUrlQueryState<TSchema extends UrlQueryStateSchema> = {
  [K in keyof TSchema]: TSchema[K] extends UrlQueryParamConfig<infer TValue> ? TValue : never;
};

type SetUrlQueryStateOptions = NavigateOptions | undefined;

type UseUrlPaginationQueryOptions = {
  pageKey?: string;
  keywordKey?: string;
  defaultPage?: number;
};

function parsePage(raw: string | null, fallback: number) {
  const value = Number.parseInt(raw || String(fallback), 10);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return value;
}

function defaultSerialize(value: unknown) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function readParamValue<T>(config: UrlQueryParamConfig<T>, raw: string | null): T {
  if (raw === null) return config.defaultValue;
  try {
    const parsed = config.parse ? config.parse(raw) : (raw as T);
    return parsed ?? config.defaultValue;
  } catch {
    return config.defaultValue;
  }
}

function writeParamValue<T>(
  next: URLSearchParams,
  key: string,
  value: T,
  config: UrlQueryParamConfig<T>,
) {
  const equals = config.equals ?? Object.is;
  if (equals(value, config.defaultValue)) {
    next.delete(key);
    return;
  }

  const serialized = config.serialize ? config.serialize(value) : defaultSerialize(value);
  if (serialized === null || serialized === '') {
    next.delete(key);
    return;
  }

  next.set(key, serialized);
}

export function stringParam(
  defaultValue = '',
  options: { trim?: boolean; resetPageOnChange?: boolean } = {},
): UrlQueryParamConfig<string> {
  const { trim = true, resetPageOnChange = false } = options;
  return {
    defaultValue,
    resetPageOnChange,
    parse: (raw) => {
      if (raw === null) return defaultValue;
      return trim ? raw.trim() : raw;
    },
    serialize: (value) => {
      const normalized = trim ? value.trim() : value;
      return normalized || null;
    },
  };
}

export function numberParam(
  defaultValue = 1,
  options: { min?: number; max?: number; resetPageOnChange?: boolean } = {},
): UrlQueryParamConfig<number> {
  const { min, max, resetPageOnChange = false } = options;
  return {
    defaultValue,
    resetPageOnChange,
    parse: (raw) => {
      const parsed = Number.parseInt(raw || String(defaultValue), 10);
      if (!Number.isFinite(parsed)) return defaultValue;
      if (min !== undefined && parsed < min) return min;
      if (max !== undefined && parsed > max) return max;
      return parsed;
    },
    serialize: (value) => String(value),
  };
}

export function enumParam<const TValue extends string>(
  allowedValues: readonly TValue[],
  defaultValue: TValue,
  options: { resetPageOnChange?: boolean } = {},
): UrlQueryParamConfig<TValue> {
  const allowedSet = new Set<string>(allowedValues);
  return {
    defaultValue,
    resetPageOnChange: options.resetPageOnChange ?? false,
    parse: (raw) => {
      if (!raw || !allowedSet.has(raw)) return defaultValue;
      return raw as TValue;
    },
    serialize: (value) => (allowedSet.has(value) ? value : defaultValue),
  };
}

export function useUrlQueryState<TSchema extends UrlQueryStateSchema>(
  schema: TSchema,
  options: { pageKey?: keyof TSchema & string } = {},
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pageKey } = options;

  const values = Object.keys(schema).reduce(
    (result, key) => {
      const typedKey = key as keyof TSchema;
      const config = schema[typedKey];
      result[typedKey] = readParamValue(
        config as UrlQueryParamConfig<InferUrlQueryState<TSchema>[typeof typedKey]>,
        searchParams.get(key),
      );
      return result;
    },
    {} as InferUrlQueryState<TSchema>,
  );

  const updateParams = useCallback(
    (updater: (next: URLSearchParams) => void, navigateOptions?: SetUrlQueryStateOptions) => {
      const next = new URLSearchParams(searchParams);
      updater(next);
      setSearchParams(next, navigateOptions);
    },
    [searchParams, setSearchParams],
  );

  const setValues = useCallback(
    (patch: Partial<InferUrlQueryState<TSchema>>, navigateOptions?: SetUrlQueryStateOptions) => {
      updateParams((next) => {
        const patchKeys = Object.keys(patch) as Array<keyof TSchema>;
        const patchHasPageKey = pageKey ? patchKeys.includes(pageKey) : false;
        let shouldResetPage = false;

        patchKeys.forEach((typedKey) => {
          const nextValue = patch[typedKey];
          if (nextValue === undefined) return;

          const key = typedKey as string;
          const config = schema[typedKey] as UrlQueryParamConfig<
            InferUrlQueryState<TSchema>[typeof typedKey]
          >;
          const previousValue = readParamValue(config, searchParams.get(key));
          const equals = config.equals ?? Object.is;

          if (
            pageKey &&
            key !== pageKey &&
            config.resetPageOnChange &&
            !equals(nextValue, previousValue)
          ) {
            shouldResetPage = true;
          }

          writeParamValue(next, key, nextValue, config);
        });

        if (pageKey && shouldResetPage && !patchHasPageKey) {
          const pageConfig = schema[pageKey] as
            | UrlQueryParamConfig<InferUrlQueryState<TSchema>[typeof pageKey]>
            | undefined;
          if (pageConfig) {
            writeParamValue(next, pageKey, pageConfig.defaultValue, pageConfig);
          }
        }
      }, navigateOptions);
    },
    [pageKey, schema, searchParams, updateParams],
  );

  const setValue = useCallback(
    <TKey extends keyof TSchema>(
      key: TKey,
      value: InferUrlQueryState<TSchema>[TKey],
      navigateOptions?: SetUrlQueryStateOptions,
    ) => {
      setValues({ [key]: value } as Partial<InferUrlQueryState<TSchema>>, navigateOptions);
    },
    [setValues],
  );

  const resetValues = useCallback(
    (keys?: Array<keyof TSchema>, navigateOptions?: SetUrlQueryStateOptions) => {
      const targetKeys = keys ?? (Object.keys(schema) as Array<keyof TSchema>);
      const patch = targetKeys.reduce(
        (result, key) => {
          result[key] = schema[key].defaultValue as InferUrlQueryState<TSchema>[typeof key];
          return result;
        },
        {} as Partial<InferUrlQueryState<TSchema>>,
      );
      setValues(patch, navigateOptions);
    },
    [schema, setValues],
  );

  return {
    searchParams,
    values,
    setValue,
    setValues,
    resetValues,
    updateParams,
  };
}

export function useUrlPaginationQuery(options: UseUrlPaginationQueryOptions = {}) {
  const { pageKey = 'page', keywordKey = 'keyword', defaultPage = 1 } = options;
  const { searchParams, values, setValue, setValues, updateParams } = useUrlQueryState(
    {
      [pageKey]: numberParam(defaultPage, { min: defaultPage }),
      [keywordKey]: stringParam('', { resetPageOnChange: true }),
    } as Record<string, UrlQueryParamConfig<unknown>>,
    { pageKey },
  );

  const page = parsePage(String(values[pageKey] ?? defaultPage), defaultPage);
  const keyword = String(values[keywordKey] ?? '').trim();

  const setPage = useCallback(
    (nextPage: number) => {
      setValue(pageKey, Math.max(defaultPage, nextPage));
    },
    [defaultPage, pageKey, setValue],
  );

  const setKeyword = useCallback(
    (nextKeyword: string, resetPage = true) => {
      const normalized = nextKeyword.trim();
      if (resetPage) {
        setValue(keywordKey, normalized);
        return;
      }

      setValues({
        [keywordKey]: normalized,
        [pageKey]: page,
      });
    },
    [keywordKey, page, pageKey, setValue, setValues],
  );

  const clearKeyword = useCallback(
    (resetPage = true) => {
      if (resetPage) {
        setValue(keywordKey, '');
        return;
      }

      setValues({
        [keywordKey]: '',
        [pageKey]: page,
      });
    },
    [keywordKey, page, pageKey, setValue, setValues],
  );

  return {
    searchParams,
    page,
    keyword,
    setPage,
    setKeyword,
    clearKeyword,
    updateParams,
  };
}
