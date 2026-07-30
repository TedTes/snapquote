export function quoteCustomerIdForSync(input: {
  quoteCustomerId: string;
  customerIdMap: ReadonlyMap<string, string>;
}): string | null {
  const mappedCustomerId = input.customerIdMap.get(input.quoteCustomerId);

  if (mappedCustomerId !== undefined) {
    return mappedCustomerId;
  }

  if (!isLocalCustomerId(input.quoteCustomerId)) {
    return input.quoteCustomerId;
  }

  return null;
}

function isLocalCustomerId(id: string) {
  return id.startsWith("cust-");
}
