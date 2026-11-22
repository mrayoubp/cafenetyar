export type Id<T extends string = string> = string & { readonly __entity?: T };
export type Doc<T extends string> = Record<string, any> & {
  _id: Id<T>;
  _creationTime: number;
};
