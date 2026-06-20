import type { PropertyType, SchemaNode } from '../types';

export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function toCamelCase(str: string): string {
  // Convert snakes, hyphens, and spaces to CamelCase
  return str
    .replace(/[^a-zA-Z0-9]/g, '_')
    .split('_')
    .filter(Boolean)
    .map(capitalize)
    .join('');
}

// Ensure unique name for classes/structs
function getUniqueName(baseName: string, existingNames: Set<string>): string {
  let name = baseName;
  let counter = 1;
  while (existingNames.has(name)) {
    name = `${baseName}${counter}`;
    counter++;
  }
  return name;
}

export interface ParseResult {
  rootType: PropertyType;
  schemas: SchemaNode[];
  error?: string;
}

export function parseJsonToSchema(jsonStr: string, rootTypeName: string = 'RootObject'): ParseResult {
  let parsed: any;
  try {
    if (!jsonStr.trim()) {
      return {
        rootType: { type: 'any' },
        schemas: [],
        error: 'Input JSON is empty.',
      };
    }
    parsed = JSON.parse(jsonStr);
  } catch (err: any) {
    return {
      rootType: { type: 'any' },
      schemas: [],
      error: `Invalid JSON syntax: ${err.message}`,
    };
  }

  const schemas: SchemaNode[] = [];
  const registeredNames = new Set<string>();

  // Deep comparison of properties to check if two schemas are identical
  function arePropertiesEqual(propsA: Record<string, PropertyType>, propsB: Record<string, PropertyType>): boolean {
    const keysA = Object.keys(propsA);
    const keysB = Object.keys(propsB);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!propsB[key]) return false;
      const typeA = propsA[key];
      const typeB = propsB[key];
      if (typeA.type !== typeB.type) return false;
      if (typeA.rawType !== typeB.rawType) return false;
      if (typeA.type === 'object' && typeA.properties && typeB.properties) {
        if (!arePropertiesEqual(typeA.properties, typeB.properties)) return false;
      }
      if (typeA.type === 'array' && typeA.itemType && typeB.itemType) {
        if (typeA.itemType.type !== typeB.itemType.type) return false;
        if (typeA.itemType.rawType !== typeB.itemType.rawType) return false;
        if (typeA.itemType.type === 'object' && typeA.itemType.properties && typeB.itemType.properties) {
          if (!arePropertiesEqual(typeA.itemType.properties, typeB.itemType.properties)) return false;
        }
      }
    }
    return true;
  }

  // Register a new schema or return existing if properties are identical
  function registerSchema(proposedName: string, properties: Record<string, PropertyType>): string {
    const camelName = toCamelCase(proposedName) || 'SubModel';
    
    // Check if we already have an identical schema
    for (const node of schemas) {
      if (arePropertiesEqual(node.properties, properties)) {
        return node.name;
      }
    }

    const uniqueName = getUniqueName(camelName, registeredNames);
    registeredNames.add(uniqueName);
    schemas.push({ name: uniqueName, properties });
    return uniqueName;
  }

  // Merging multiple PropertyTypes (used for arrays)
  function mergePropertyTypes(types: PropertyType[], parentKey: string): PropertyType {
    if (types.length === 0) return { type: 'any' };

    // Group types by their category
    const categories = new Set(types.map(t => t.type));
    
    // Remove 'null' as a distinct type if other types exist
    if (categories.size > 1 && categories.has('null')) {
      categories.delete('null');
    }

    if (categories.size > 1) {
      // If we have mixed types, fall back to any (or string as a default representation)
      return { type: 'any' };
    }

    const baseType = Array.from(categories)[0];

    if (baseType === 'object') {
      // Merge properties of all objects in the list
      const mergedProps: Record<string, PropertyType> = {};
      const allKeys = new Set<string>();
      
      types.forEach(t => {
        if (t.properties) {
          Object.keys(t.properties).forEach(k => allKeys.add(k));
        }
      });

      allKeys.forEach(key => {
        const typesForKey: PropertyType[] = [];
        types.forEach(t => {
          if (t.properties && t.properties[key]) {
            typesForKey.push(t.properties[key]);
          }
        });
        mergedProps[key] = mergePropertyTypes(typesForKey, key);
      });

      const schemaName = registerSchema(parentKey + 'Item', mergedProps);
      return { type: 'object', rawType: schemaName, properties: mergedProps };
    }

    if (baseType === 'array') {
      // Merge item types
      const itemTypes: PropertyType[] = [];
      types.forEach(t => {
        if (t.itemType) itemTypes.push(t.itemType);
      });
      const mergedItemType = mergePropertyTypes(itemTypes, parentKey + 'Element');
      return { type: 'array', itemType: mergedItemType };
    }

    return { type: baseType };
  }

  // Recursive parser
  function parseValue(value: any, keyName: string): PropertyType {
    if (value === null) {
      return { type: 'null' };
    }

    if (Array.isArray(value)) {
      const parsedItems = value.map((item) => parseValue(item, keyName));
      const mergedItemType = mergePropertyTypes(parsedItems, keyName);
      return {
        type: 'array',
        itemType: mergedItemType,
      };
    }

    if (typeof value === 'object') {
      const properties: Record<string, PropertyType> = {};
      Object.keys(value).forEach(k => {
        properties[k] = parseValue(value[k], k);
      });

      const schemaName = registerSchema(keyName, properties);
      return {
        type: 'object',
        rawType: schemaName,
        properties,
      };
    }

    if (typeof value === 'string') {
      return { type: 'string' };
    }

    if (typeof value === 'number') {
      return { type: 'number' };
    }

    if (typeof value === 'boolean') {
      return { type: 'boolean' };
    }

    return { type: 'any' };
  }

  // Parse the root element
  const rootType = parseValue(parsed, rootTypeName);

  // If the root was an object or array of objects, it registered schemas.
  // Make sure we have the root schema registered properly if it was an object.
  if (rootType.type === 'object' && rootType.rawType) {
    // Already registered, we can rename the last schema name to our custom rootTypeName if needed.
    const lastSchema = schemas.find(s => s.name === rootType.rawType);
    if (lastSchema) {
      // Check if rootTypeName is already registered. If yes, it's fine.
      // If not, we can adjust names.
    }
  }

  return {
    rootType,
    schemas,
  };
}
