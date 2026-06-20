export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface HeaderItem {
  id: string;
  key: string;
  value: string;
  active: boolean;
}

export type TargetLanguage =
  | 'dart'
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'kotlin'
  | 'csharp'
  | 'php'
  | 'go'
  | 'ruby'
  | 'rust';

export interface PropertyType {
  type: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array' | 'any';
  rawType?: string; // used for custom names like UserProfile
  properties?: Record<string, PropertyType>; // if object
  itemType?: PropertyType; // if array
}

export interface SchemaNode {
  name: string;
  properties: Record<string, PropertyType>;
}

export interface FirebaseCredentials {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

export interface SavedConfig {
  id: string;
  title: string;
  url: string;
  method: HttpMethod;
  headers: HeaderItem[];
  requestBody: string;
  pastedJson: string;
  rootTypeName: string;
  language: TargetLanguage;
  updatedAt: number;
}
