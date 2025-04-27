import {
  createContext,
  type MutableRefObject,
  ProviderProps,
  useContext,
  useEffect,
  useRef,
} from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

type FormContextRef<TFieldValues extends FieldValues = FieldValues, TContext = any, TTransformedValues = TFieldValues> =
  MutableRefObject<Partial<UseFormReturn<TFieldValues, TContext, TTransformedValues>>>;

const FormContextRef = createContext<FormContextRef | undefined>(undefined);
export const FormContextRefProvider = <TFieldValues extends FieldValues = FieldValues, TContext = any, TTransformedValues = TFieldValues>(
  { value, children }: ProviderProps<FormContextRef<TFieldValues, TContext, TTransformedValues>>
) => (
  <FormContextRef.Provider value={value as FormContextRef}>
    {children}
  </FormContextRef.Provider>
  );

export const useFormContextRefValue = <TFieldValues extends FieldValues = FieldValues, TContext = any, TTransformedValues = TFieldValues>(
  methods: Partial<UseFormReturn<TFieldValues, TContext, TTransformedValues>>
) => {
  const ref = useRef(methods);

  useEffect(() => {
    ref.current = methods;
  }, [methods]);

  return ref;
};

export const useFormContextRef = <TFieldValues extends FieldValues = FieldValues, TContext = any, TTransformedValues = TFieldValues>() => {
  const context = useContext(FormContextRef);
  if (!context) {
    throw new Error('useFormContextRef must be used within a FormContextRefProvider');
  }

  return context.current as Omit<UseFormReturn<TFieldValues, TContext, TTransformedValues>, 'formState'>;
};
