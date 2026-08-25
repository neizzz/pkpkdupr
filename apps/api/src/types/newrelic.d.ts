declare module "newrelic" {
  const newrelic: {
    addCustomAttribute(name: string, value: string | number | boolean): void;
    addCustomAttributes(attributes: Record<string, string | number | boolean>): void;
  };

  export default newrelic;
}
