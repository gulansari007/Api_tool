import type { HeaderItem, HttpMethod, PropertyType, SchemaNode, TargetLanguage } from '../types';
import { toCamelCase, capitalize } from './parser';

// Resolve item type name for arrays
function getItemTypeName(prop: PropertyType, lang: TargetLanguage): string {
  if (prop.type === 'array' && prop.itemType) {
    return getItemTypeName(prop.itemType, lang);
  }
  if (prop.type === 'object' && prop.rawType) {
    return prop.rawType;
  }
  return getPrimitiveTypeName(prop, lang);
}

// Resolve primitive type names by language
function getPrimitiveTypeName(prop: PropertyType, lang: TargetLanguage): string {
  switch (lang) {
    case 'dart':
      switch (prop.type) {
        case 'string': return 'String';
        case 'number': return 'num';
        case 'boolean': return 'bool';
        default: return 'dynamic';
      }
    case 'typescript':
      switch (prop.type) {
        case 'string': return 'string';
        case 'number': return 'number';
        case 'boolean': return 'boolean';
        default: return 'any';
      }
    case 'javascript':
      switch (prop.type) {
        case 'string': return 'string';
        case 'number': return 'number';
        case 'boolean': return 'boolean';
        default: return 'Object';
      }
    case 'python':
      switch (prop.type) {
        case 'string': return 'str';
        case 'number': return 'float';
        case 'boolean': return 'bool';
        default: return 'Any';
      }
    case 'java':
      switch (prop.type) {
        case 'string': return 'String';
        case 'number': return 'Double';
        case 'boolean': return 'Boolean';
        default: return 'Object';
      }
    case 'kotlin':
      switch (prop.type) {
        case 'string': return 'String';
        case 'number': return 'Double';
        case 'boolean': return 'Boolean';
        default: return 'Any';
      }
    case 'csharp':
      switch (prop.type) {
        case 'string': return 'string';
        case 'number': return 'double';
        case 'boolean': return 'bool';
        default: return 'object';
      }
    case 'php':
      switch (prop.type) {
        case 'string': return 'string';
        case 'number': return 'float';
        case 'boolean': return 'bool';
        default: return 'mixed';
      }
    case 'go':
      switch (prop.type) {
        case 'string': return 'string';
        case 'number': return 'float64';
        case 'boolean': return 'bool';
        default: return 'interface{}';
      }
    case 'rust':
      switch (prop.type) {
        case 'string': return 'String';
        case 'number': return 'f64';
        case 'boolean': return 'bool';
        default: return 'serde_json::Value';
      }
    default:
      return 'any';
  }
}

// Generate Headers configuration representation
function getHeaderFormatting(headers: HeaderItem[], lang: TargetLanguage): string {
  const activeHeaders = headers.filter(h => h.active && h.key && h.value);
  if (activeHeaders.length === 0) return '';

  switch (lang) {
    case 'javascript':
    case 'typescript':
      return activeHeaders.map(h => `      '${h.key}': '${h.value}',`).join('\n');
    case 'python':
      return activeHeaders.map(h => `        "${h.key}": "${h.value}",`).join('\n');
    case 'ruby':
      return activeHeaders.map(h => `    request["${h.key}"] = "${h.value}"`).join('\n');
    case 'go':
      return activeHeaders.map(h => `    req.Header.Set("${h.key}", "${h.value}")`).join('\n');
    case 'rust':
      return activeHeaders.map(h => `        .header("${h.key}", "${h.value}")`).join('\n');
    case 'dart':
      return activeHeaders.map(h => `        '${h.key}': '${h.value}',`).join('\n');
    case 'java':
      return activeHeaders.map(h => `                .header("${h.key}", "${h.value}")`).join('\n');
    case 'kotlin':
      return activeHeaders.map(h => `            .addHeader("${h.key}", "${h.value}")`).join('\n');
    case 'csharp':
      return activeHeaders.map(h => `            request.Headers.Add("${h.key}", "${h.value}");`).join('\n');
    case 'php':
      return activeHeaders.map(h => `                    '${h.key}' => '${h.value}',`).join('\n');
    default:
      return '';
  }
}

// Client generator mapping dynamic collection return type if JSON is array
export function generateClientCode(
  lang: TargetLanguage,
  url: string,
  method: HttpMethod,
  headers: HeaderItem[],
  requestBody: string,
  rootTypeName: string,
  rootType: PropertyType
): string {
  const cleanUrl = url || 'https://api.example.com/data';
  const hasBody = (method === 'POST' || method === 'PUT' || method === 'DELETE');
  const formattedHeaders = getHeaderFormatting(headers, lang);

  const isArray = rootType.type === 'array';
  const itemTypeName = isArray && rootType.itemType ? getItemTypeName(rootType.itemType, lang) : toCamelCase(rootTypeName);
  const rootTypeCamel = toCamelCase(rootTypeName);

  switch (lang) {
    case 'dart': {
      const returnType = isArray ? `List<${itemTypeName}>` : rootTypeCamel;
      const parseLogic = isArray
        ? `final List<dynamic> data = jsonDecode(response.body);\n      return data.map((item) => ${itemTypeName}.fromJson(item as Map<String, dynamic>)).toList();`
        : `final Map<String, dynamic> data = jsonDecode(response.body);\n      return ${rootTypeCamel}.fromJson(data);`;

      return `import 'package:http/http.dart' as http;
import 'dart:convert';

Future<${returnType}> fetch${rootTypeCamel}() async {
  final url = Uri.parse('${cleanUrl}');
  try {
    final response = await http.${method.toLowerCase()}(
      url,
      headers: {
        'Content-Type': 'application/json',
${formattedHeaders}
      },${hasBody ? `\n      body: jsonEncode(${requestBody || '{}'}),` : ''}
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      ${parseLogic}
    } else {
      throw Exception('Server error: status \${response.statusCode} - \${response.body}');
    }
  } catch (e) {
    throw Exception('Failed to perform API request: \$e');
  }
}`;
    }

    case 'javascript': {
      const docReturn = isArray ? `Array<${itemTypeName}>` : 'Object';
      return `import axios from 'axios';

/**
 * Invokes the API and returns the payload data
 * @returns {Promise<${docReturn}>} API JSON response data
 */
export async function fetch${rootTypeCamel}() {
  try {
    const response = await axios({
      method: '${method}',
      url: '${cleanUrl}',
      headers: {
        'Content-Type': 'application/json',
${formattedHeaders}
      },${hasBody ? `\n      data: ${requestBody || '{}'},` : ''}
    });

    return response.data;
  } catch (error) {
    console.error('API client request failed:', error.response?.data || error.message);
    throw error;
  }
}`;
    }

    case 'typescript': {
      const returnType = isArray ? `${itemTypeName}[]` : rootTypeCamel;
      return `import axios, { AxiosResponse } from 'axios';

export async function fetch${rootTypeCamel}(): Promise<${returnType}> {
  try {
    const response: AxiosResponse<${returnType}> = await axios({
      method: '${method}',
      url: '${cleanUrl}',
      headers: {
        'Content-Type': 'application/json',
${formattedHeaders}
      },${hasBody ? `\n      data: ${requestBody || '{}'},` : ''}
    });

    return response.data;
  } catch (error: any) {
    console.error('API Client error:', error.response?.data || error.message);
    throw error;
  }
}`;
    }

    case 'python': {
      const returnType = isArray ? `List[${itemTypeName}]` : 'dict';
      return `import requests
from typing import Dict, Any, List

def fetch_${rootTypeCamel.toLowerCase()}() -> ${returnType}:
    url = "${cleanUrl}"
    headers = {
        "Content-Type": "application/json",
${formattedHeaders}
    }
    
    try {
        response = requests.${method.toLowerCase()}(
            url,
            headers=headers,${hasBody ? `\n            json=${requestBody || '{}'},` : ''}
            timeout=15
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Network error in fetch_${rootTypeCamel.toLowerCase()}: {e}")
        raise e`;
    }

    case 'java': {
      const returnType = isArray ? `List<${itemTypeName}>` : rootTypeCamel;
      return `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

public class ApiClient {
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public ${returnType} fetch${rootTypeCamel}() {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create("${cleanUrl}"))
                .header("Content-Type", "application/json")
${formattedHeaders ? formattedHeaders + '\n' : ''}                .timeout(Duration.ofSeconds(10));

        switch ("${method}") {
            case "POST":
                builder.POST(HttpRequest.BodyPublishers.ofString(${hasBody ? JSON.stringify(requestBody || '{}') : '""'}));
                break;
            case "PUT":
                builder.PUT(HttpRequest.BodyPublishers.ofString(${hasBody ? JSON.stringify(requestBody || '{}') : '""'}));
                break;
            case "DELETE":
                builder.DELETE();
                break;
            default:
                builder.GET();
                break;
        }

        try {
            HttpResponse<String> response = httpClient.send(
                    builder.build(),
                    HttpResponse.BodyHandlers.ofString()
            );

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                // String payload = response.body();
                // return objectMapper.readValue(payload, ${isArray ? `new TypeReference<List<${itemTypeName}>>(){}` : `${rootTypeCamel}.class`});
                throw new UnsupportedOperationException("Mapping logic requires parsing library. Body: " + response.body());
            } else {
                throw new RuntimeException("HTTP call failed status: " + response.statusCode());
            }
        } catch (Exception e) {
            throw new RuntimeException("Exception performing HttpClient call: " + e.getMessage(), e);
        }
    }
}`;
    }

    case 'kotlin': {
      const returnType = isArray ? `List<${itemTypeName}>` : rootTypeCamel;
      return `import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException

class ApiClient {
    private val client = OkHttpClient()

    suspend fun fetch${rootTypeCamel}(): ${returnType} = withContext(Dispatchers.IO) {
        val mediaType = "application/json; charset=utf-8".toMediaType()
        
        val request = Request.Builder()
            .url("${cleanUrl}")
            .addHeader("Content-Type", "application/json")
${formattedHeaders}
            .method(
                "${method}",
                ${hasBody ? `"""${requestBody || '{}'}""".toRequestBody(mediaType)` : 'null'}
            )
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Request failed with status code $response")
            val payload = response.body?.string() ?: throw IOException("Empty payload response")
            // return Json.decodeFromString<${returnType}>(payload)
            throw UnsupportedOperationException("Deserialization requires Json library.")
        }
    }
}`;
    }

    case 'csharp': {
      const returnType = isArray ? `List<${itemTypeName}>` : rootTypeCamel;
      return `using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;

public class ApiClient
{
    private static readonly HttpClient client = new HttpClient();

    public async Task<${returnType}> Fetch${rootTypeCamel}Async()
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.${capitalize(method.toLowerCase())}, "${cleanUrl}");
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
${formattedHeaders}
            ${hasBody ? `request.Content = new StringContent("${requestBody.replace(/"/g, '\\"')}", Encoding.UTF8, "application/json");` : ''}

            var response = await client.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var jsonString = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<${returnType}>(jsonString);
        }
        catch (HttpRequestException e)
        {
            Console.WriteLine($"API Request failed: {e.Message}");
            throw;
        }
    }
}`;
    }

    case 'php': {
      const returnType = isArray ? 'array' : rootTypeCamel;
      const mapping = isArray
        ? `return array_map(fn($item) => ${itemTypeName}::fromArray($item), json_decode($response->getBody()->getContents(), true));`
        : `return ${rootTypeCamel}::fromArray(json_decode($response->getBody()->getContents(), true));`;

      return `<?php
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

class ApiClient {
    private $client;

    public function __construct() {
        $this->client = new Client();
    }

    public function fetch${rootTypeCamel}(): ${returnType} {
        try {
            $options = [
                'headers' => [
                    'Content-Type' => 'application/json',
${formattedHeaders}
                ]
            ];
            ${hasBody ? `\n            $options['body'] = '${requestBody || '{}'}';` : ''}

            $response = $this->client->request('${method}', '${cleanUrl}', $options);
            
            if ($response->getStatusCode() >= 200 && $response->getStatusCode() < 300) {
                ${mapping}
            }
            throw new Exception("HTTP status error: " . $response->getStatusCode());
        } catch (RequestException $e) {
            throw new Exception("API request exception: " . $e->getMessage());
        }
    }
}`;
    }

    case 'go': {
      const returnType = isArray ? `[]${itemTypeName}` : rootTypeCamel;
      const initVar = isArray ? `var result []${itemTypeName}` : `var result ${rootTypeCamel}`;
      return `package main

import (
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "strings"
    "time"
)

func Fetch${rootTypeCamel}(ctx context.Context) (${returnType}, error) {
    var bodyReader io.Reader
    ${hasBody ? `bodyReader = strings.NewReader(\`${requestBody || '{}'}\`)` : 'bodyReader = nil'}

    req, err := http.NewRequestWithContext(ctx, "${method}", "${cleanUrl}", bodyReader)
    if err != nil {
        ${isArray ? 'return nil, err' : 'return result, err'}
    }

    req.Header.Set("Content-Type", "application/json")
${formattedHeaders}

    client := &http.Client{
        Timeout: 10 * time.Second,
    }

    resp, err := client.Do(req)
    if err != nil {
        ${isArray ? 'return nil, err' : 'return result, err'}
    }
    defer resp.Body.Close()

    bodyBytes, err := io.ReadAll(resp.Body)
    if err != nil {
        ${isArray ? 'return nil, err' : 'return result, err'}
    }

    if resp.StatusCode < 200 || resp.StatusCode >= 300 {
        ${isArray ? 'return nil, fmt.Errorf("http error status: %d", resp.StatusCode)' : 'return result, fmt.Errorf("http error status: %d", resp.StatusCode)'}
    }

    ${initVar}
    if err := json.Unmarshal(bodyBytes, &result); err != nil {
        ${isArray ? 'return nil, err' : 'return result, err'}
    }

    return result, nil
}`;
    }

    case 'ruby': {
      const mapping = isArray
        ? `JSON.parse(response.body).map { |item| ${itemTypeName}.new(item) }`
        : `${rootTypeCamel}.new(JSON.parse(response.body))`;

      return `require 'net/http'
require 'uri'
require 'json'

def fetch_${rootTypeCamel.toLowerCase()}
  uri = URI.parse("${cleanUrl}")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true if uri.scheme == 'https'

  request = Net::HTTP::${capitalize(method.toLowerCase())}.new(uri.request_uri)
  request.content_type = 'application/json'
${formattedHeaders}
  ${hasBody ? `request.body = '${requestBody || '{}'}'` : ''}

  begin
    response = http.request(request)
    if response.code.to_i >= 200 && response.code.to_i < 300
      ${mapping}
    else
      raise "Request failed with code #{response.code}: #{response.body}"
    end
  rescue StandardError => e
    puts "Error caught: #{e.message}"
    raise e
  end
end`;
    }

    case 'rust': {
      const returnType = isArray ? `Vec<${itemTypeName}>` : rootTypeCamel;
      const parseLogic = isArray
        ? `let data = response.json::<Vec<${itemTypeName}>>().await?;`
        : `let data = response.json::<${rootTypeCamel}>().await?;`;

      return `use reqwest::Client;

pub async fn fetch_${rootTypeCamel.toLowerCase()}() -> Result<${returnType}, reqwest::Error> {
    let client = Client::new();
    let response = client
        .${method.toLowerCase()}("${cleanUrl}")
        .header("Content-Type", "application/json")
${formattedHeaders}
        ${hasBody ? `.body(r#"${requestBody || '{}'}"#)` : ''}
        .send()
        .await?;

    if response.status().is_success() {
        ${parseLogic}
        Ok(data)
    } else {
        response.error_for_status()
            .map(|_| ${isArray ? 'Vec::new()' : `${rootTypeCamel}::default()`})
    }
}`;
    }

    default:
      return '';
  }
}

// Generate structural model schema definitions recursively
export function generateModelCode(
  lang: TargetLanguage,
  parsed: { rootType: PropertyType; schemas: SchemaNode[] },
  _rootTypeName: string
): string {
  const rootType = parsed.rootType;
  const schemas = parsed.schemas;

  if (rootType.type === 'any' || rootType.type === 'null') {
    return ``;
  }

  switch (lang) {
    case 'dart': {
      const codeBlocks: string[] = [];

      schemas.forEach((node) => {
        const fields = Object.entries(node.properties).map(([key, prop]) => {
          const typeStr = getDartType(prop);
          return `  final ${typeStr} ${toLowerCamelCase(key)};`;
        }).join('\n');

        const constructorArgs = Object.keys(node.properties).map((key) => {
          return `    required this.${toLowerCamelCase(key)},`;
        }).join('\n');

        const fromJsonAssignments = Object.entries(node.properties).map(([key, prop]) => {
          const lKey = toLowerCamelCase(key);
          const dartType = getDartType(prop);
          
          if (prop.type === 'object' && prop.rawType) {
            return `      ${lKey}: json['${key}'] != null ? ${prop.rawType}.fromJson(json['${key}'] as Map<String, dynamic>) : null,`;
          } else if (prop.type === 'array' && prop.itemType) {
            const itemTypeStr = getDartType(prop.itemType);
            if (prop.itemType.type === 'object' && prop.itemType.rawType) {
              return `      ${lKey}: (json['${key}'] as List?)?.map((i) => ${prop.itemType.rawType}.fromJson(i as Map<String, dynamic>)).toList() ?? [],`;
            } else {
              return `      ${lKey}: List<${itemTypeStr.replace('?', '')}>.from(json['${key}'] ?? []),`;
            }
          } else {
            return `      ${lKey}: json['${key}'] as ${dartType},`;
          }
        }).join('\n');

        const toJsonAssignments = Object.keys(node.properties).map((key) => {
          const lKey = toLowerCamelCase(key);
          const prop = node.properties[key];
          if (prop.type === 'object') {
            return `      '${key}': ${lKey}?.toJson(),`;
          } else if (prop.type === 'array' && prop.itemType && prop.itemType.type === 'object') {
            return `      '${key}': ${lKey}?.map((i) => i.toJson()).toList(),`;
          } else {
            return `      '${key}': ${lKey},`;
          }
        }).join('\n');

        codeBlocks.push(`class ${node.name} {
${fields}

  ${node.name}({
${constructorArgs}
  });

  factory ${node.name}.fromJson(Map<String, dynamic> json) {
    return ${node.name}(
${fromJsonAssignments}
    );
  }

  Map<String, dynamic> toJson() {
    return {
${toJsonAssignments}
    };
  }
}`);
      });

      return codeBlocks.join('\n\n');
    }

    case 'javascript': {
      const blocks: string[] = [];

      schemas.forEach((node) => {
        const propLines = Object.entries(node.properties).map(([key, prop]) => {
          const jsType = getJsDocType(prop);
          return ` * @property {${jsType}} ${key}`;
        }).join('\n');

        blocks.push(`/**
 * @typedef {Object} ${node.name}
${propLines}
 */`);
      });

      return blocks.join('\n\n');
    }

    case 'typescript': {
      const codeBlocks: string[] = [];

      schemas.forEach((node) => {
        const fields = Object.entries(node.properties).map(([key, prop]) => {
          const tsType = getTsType(prop);
          const isOptional = prop.type === 'null' || prop.type === 'any' ? '?' : '';
          return `  ${key}${isOptional}: ${tsType};`;
        }).join('\n');

        codeBlocks.push(`export interface ${node.name} {
${fields}
}`);
      });

      return codeBlocks.join('\n\n');
    }

    case 'python': {
      const codeBlocks: string[] = ['from dataclasses import dataclass\nfrom typing import List, Optional, Any, Dict'];

      schemas.forEach((node) => {
        const fields = Object.entries(node.properties).map(([key, prop]) => {
          const pyType = getPythonType(prop);
          const snakeKey = toSnakeCase(key);
          return `    ${snakeKey}: ${pyType}`;
        }).join('\n');

        codeBlocks.push(`@dataclass
class ${node.name}:
${fields || '    pass'}`);
      });

      return codeBlocks.join('\n\n');
    }

    case 'java': {
      const codeBlocks: string[] = ['import com.fasterxml.jackson.annotation.JsonProperty;\nimport java.util.List;\nimport java.util.Map;'];

      schemas.forEach((node) => {
        const fields = Object.entries(node.properties).map(([key, prop]) => {
          const jType = getJavaType(prop);
          const fName = toLowerCamelCase(key);
          return `    @JsonProperty("${key}")\n    private ${jType} ${fName};`;
        }).join('\n\n');

        const gettersSetters = Object.entries(node.properties).map(([key, prop]) => {
          const jType = getJavaType(prop);
          const fName = toLowerCamelCase(key);
          const capName = capitalize(fName);
          return `    public ${jType} get${capName}() { return this.${fName}; }\n    public void set${capName}(${jType} ${fName}) { this.${fName} = ${fName}; }`;
        }).join('\n\n');

        codeBlocks.push(`public class ${node.name} {
${fields}

${gettersSetters}
}`);
      });

      return codeBlocks.join('\n\n');
    }

    case 'kotlin': {
      const codeBlocks: string[] = ['import kotlinx.serialization.Serializable\nimport kotlinx.serialization.SerialName'];

      schemas.forEach((node) => {
        const constructorArgs = Object.entries(node.properties).map(([key, prop]) => {
          const kType = getKotlinType(prop);
          const fName = toLowerCamelCase(key);
          return `    @SerialName("${key}") val ${fName}: ${kType}`;
        }).join(',\n');

        codeBlocks.push(`@Serializable
data class ${node.name}(
${constructorArgs}
)`);
      });

      return codeBlocks.join('\n\n');
    }

    case 'csharp': {
      const codeBlocks: string[] = ['using System.Text.Json.Serialization;\nusing System.Collections.Generic;'];

      schemas.forEach((node) => {
        const constructorArgs = Object.entries(node.properties).map(([key, prop]) => {
          const csType = getCsharpType(prop);
          const fName = capitalize(toLowerCamelCase(key));
          return `    [property: JsonPropertyName("${key}")] ${csType} ${fName}`;
        }).join(',\n');

        codeBlocks.push(`public record ${node.name}(
${constructorArgs}
);`);
      });

      return codeBlocks.join('\n\n');
    }

    case 'php': {
      const codeBlocks: string[] = [];

      schemas.forEach((node) => {
        const typedProperties = Object.entries(node.properties).map(([key, prop]) => {
          const phpType = getPhpType(prop);
          const doc = (prop.type === 'array') ? `      /** @var ${getPhpDocArrayType(prop)} */\n` : '';
          return `${doc}      public ${phpType} $${toLowerCamelCase(key)}`;
        }).join(',\n');

        const fromArrayMappings = Object.entries(node.properties).map(([key, prop]) => {
          const fName = toLowerCamelCase(key);
          
          if (prop.type === 'object' && prop.rawType) {
            return `            ${fName}: isset($data['${key}']) ? ${prop.rawType}::fromArray($data['${key}']) : null`;
          } else if (prop.type === 'array' && prop.itemType) {
            if (prop.itemType.type === 'object' && prop.itemType.rawType) {
              return `            ${fName}: array_map(fn($item) => ${prop.itemType.rawType}::fromArray($item), $data['${key}'] ?? [])`;
            } else {
              return `            ${fName}: $data['${key}'] ?? []`;
            }
          } else {
            return `            ${fName}: $data['${key}'] ?? null`;
          }
        }).join(',\n');

        codeBlocks.push(`class ${node.name} {
    public function __construct(
${typedProperties}
    ) {}

    public static function fromArray(array $data): self {
        return new self(
${fromArrayMappings}
        );
    }
}`);
      });

      return codeBlocks.join('\n\n');
    }

    case 'go': {
      const codeBlocks: string[] = [];

      schemas.forEach((node) => {
        const fields = Object.entries(node.properties).map(([key, prop]) => {
          const goType = getGoType(prop);
          const titleKey = capitalize(toCamelCase(key));
          return `    ${titleKey} ${goType} \`json:"${key}"\``;
        }).join('\n');

        codeBlocks.push(`type ${node.name} struct {
${fields}
}`);
      });

      return codeBlocks.join('\n\n');
    }

    case 'ruby': {
      const codeBlocks: string[] = [];

      schemas.forEach((node) => {
        const accessors = `  attr_accessor ` + Object.keys(node.properties).map(k => `:${toSnakeCase(k)}`).join(', ');
        
        const assignments = Object.entries(node.properties).map(([key, prop]) => {
          const sKey = toSnakeCase(key);
          if (prop.type === 'object' && prop.rawType) {
            return `    @${sKey} = data['${key}'] ? ${prop.rawType}.new(data['${key}']) : nil`;
          } else if (prop.type === 'array' && prop.itemType) {
            if (prop.itemType.type === 'object' && prop.itemType.rawType) {
              return `    @${sKey} = data['${key}'] ? data['${key}'].map { |item| ${prop.itemType.rawType}.new(item) } : []`;
            } else {
              return `    @${sKey} = data['${key}'] || []`;
            }
          } else {
            return `    @${sKey} = data['${key}']`;
          }
        }).join('\n');

        codeBlocks.push(`class ${node.name}
${accessors}

  def initialize(data)
${assignments}
  end
end`);
      });

      return codeBlocks.join('\n\n');
    }

    case 'rust': {
      const codeBlocks: string[] = [];

      schemas.forEach((node) => {
        const fields = Object.entries(node.properties).map(([key, prop]) => {
          const rustType = getRustType(prop);
          const needsRename = key !== toSnakeCase(key);
          const renameAttr = needsRename ? `    #[serde(rename = "${key}")]\n` : '';
          return `${renameAttr}    pub ${toSnakeCase(key)}: ${rustType},`;
        }).join('\n');

        codeBlocks.push(`#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ${node.name} {
${fields}
}`);
      });

      return codeBlocks.join('\n\n');
    }

    default:
      return '';
  }
}

// Unified Code Generator concatenating client wrappers and recursive models
export function generateUnifiedCode(
  lang: TargetLanguage,
  parsed: { rootType: PropertyType; schemas: SchemaNode[] },
  url: string,
  method: HttpMethod,
  headers: HeaderItem[],
  requestBody: string,
  rootTypeName: string
): string {
  const client = generateClientCode(lang, url, method, headers, requestBody, rootTypeName, parsed.rootType);
  const models = generateModelCode(lang, parsed, rootTypeName);

  if (!models.trim()) {
    return client;
  }

  // Java & PHP - structure output inside packages or class containers nicely
  if (lang === 'php') {
    return `<?php\n\n${client}\n\n${models}`;
  }
  if (lang === 'go') {
    // Merge go definitions, but avoid duplicate imports
    return `${client}\n\n${models}`;
  }

  return `${client}\n\n${models}`;
}

// Low level mapping utilities
function toLowerCamelCase(str: string): string {
  const camel = toCamelCase(str);
  if (!camel) return '';
  return camel.charAt(0).toLowerCase() + camel.slice(1);
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase()
    .replace(/_+/g, '_');
}

function getDartType(prop: PropertyType): string {
  switch (prop.type) {
    case 'string': return 'String?';
    case 'number': return 'num?';
    case 'boolean': return 'bool?';
    case 'object': return `${prop.rawType}?`;
    case 'array': return `List<${prop.itemType ? getDartTypeNoOpt(prop.itemType) : 'dynamic'}>`;
    case 'null':
    case 'any':
    default: return 'dynamic';
  }
}

function getDartTypeNoOpt(prop: PropertyType): string {
  switch (prop.type) {
    case 'string': return 'String';
    case 'number': return 'num';
    case 'boolean': return 'bool';
    case 'object': return prop.rawType || 'dynamic';
    case 'array': return `List<${prop.itemType ? getDartTypeNoOpt(prop.itemType) : 'dynamic'}>`;
    case 'null':
    case 'any':
    default: return 'dynamic';
  }
}

function getJsDocType(prop: PropertyType): string {
  switch (prop.type) {
    case 'string': return 'string';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'object': return prop.rawType || 'Object';
    case 'array': return `Array<${prop.itemType ? getJsDocType(prop.itemType) : 'any'}>`;
    case 'null': return 'null';
    case 'any':
    default: return '*';
  }
}

function getTsType(prop: PropertyType): string {
  switch (prop.type) {
    case 'string': return 'string';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'object': return prop.rawType || 'any';
    case 'array': return `${prop.itemType ? getTsType(prop.itemType) : 'any'}[]`;
    case 'null': return 'null';
    case 'any':
    default: return 'any';
  }
}

function getPythonType(prop: PropertyType): string {
  switch (prop.type) {
    case 'string': return 'str';
    case 'number': return 'float';
    case 'boolean': return 'bool';
    case 'object': return `${prop.rawType}`;
    case 'array': return `List[${prop.itemType ? getPythonType(prop.itemType) : 'Any'}]`;
    case 'null': return 'Optional[Any]';
    case 'any':
    default: return 'Any';
  }
}

function getJavaType(prop: PropertyType): string {
  switch (prop.type) {
    case 'string': return 'String';
    case 'number': return 'Double';
    case 'boolean': return 'Boolean';
    case 'object': return prop.rawType || 'Object';
    case 'array': return `List<${prop.itemType ? getJavaType(prop.itemType) : 'Object'}>`;
    case 'null':
    case 'any':
    default: return 'Object';
  }
}

function getKotlinType(prop: PropertyType): string {
  switch (prop.type) {
    case 'string': return 'String?';
    case 'number': return 'Double?';
    case 'boolean': return 'Boolean?';
    case 'object': return `${prop.rawType}?`;
    case 'array': return `List<${prop.itemType ? getKotlinTypeNoOpt(prop.itemType) : 'Any'}>?`;
    case 'null':
    case 'any':
    default: return 'Any?';
  }
}

function getKotlinTypeNoOpt(prop: PropertyType): string {
  switch (prop.type) {
    case 'string': return 'String';
    case 'number': return 'Double';
    case 'boolean': return 'Boolean';
    case 'object': return prop.rawType || 'Any';
    case 'array': return `List<${prop.itemType ? getKotlinTypeNoOpt(prop.itemType) : 'Any'}>`;
    case 'null':
    case 'any':
    default: return 'Any';
  }
}

function getCsharpType(prop: PropertyType): string {
  switch (prop.type) {
    case 'string': return 'string?';
    case 'number': return 'double?';
    case 'boolean': return 'bool?';
    case 'object': return `${prop.rawType}?`;
    case 'array': return `List<${prop.itemType ? getCsharpTypeNoOpt(prop.itemType) : 'object'}>?`;
    case 'null':
    case 'any':
    default: return 'object?';
  }
}

function getCsharpTypeNoOpt(prop: PropertyType): string {
  switch (prop.type) {
    case 'string': return 'string';
    case 'number': return 'double';
    case 'boolean': return 'bool';
    case 'object': return prop.rawType || 'object';
    case 'array': return `List<${prop.itemType ? getCsharpTypeNoOpt(prop.itemType) : 'object'}>`;
    case 'null':
    case 'any':
    default: return 'object';
  }
}

function getPhpType(prop: PropertyType): string {
  switch (prop.type) {
    case 'string': return '?string';
    case 'number': return '?float';
    case 'boolean': return '?bool';
    case 'object': return `?${prop.rawType}`;
    case 'array': return 'array';
    case 'null':
    case 'any':
    default: return 'mixed';
  }
}

function getPhpDocArrayType(prop: PropertyType): string {
  if (prop.type === 'array' && prop.itemType) {
    if (prop.itemType.type === 'object') {
      return `${prop.itemType.rawType}[]`;
    }
    return `${prop.itemType.type}[]`;
  }
  return 'array';
}

function getGoType(prop: PropertyType): string {
  switch (prop.type) {
    case 'string': return 'string';
    case 'number': return 'float64';
    case 'boolean': return 'bool';
    case 'object': return prop.rawType || 'interface{}';
    case 'array': return `[]${prop.itemType ? getGoType(prop.itemType) : 'interface{}'}`;
    case 'null':
    case 'any':
    default: return 'interface{}';
  }
}

function getRustType(prop: PropertyType): string {
  switch (prop.type) {
    case 'string': return 'Option<String>';
    case 'number': return 'Option<f64>';
    case 'boolean': return 'Option<bool>';
    case 'object': return `Option<${prop.rawType}>`;
    case 'array': return `Vec<${prop.itemType ? getRustTypeNoOpt(prop.itemType) : 'serde_json::Value'}>`;
    case 'null':
    case 'any':
    default: return 'Option<serde_json::Value>';
  }
}

function getRustTypeNoOpt(prop: PropertyType): string {
  switch (prop.type) {
    case 'string': return 'String';
    case 'number': return 'f64';
    case 'boolean': return 'bool';
    case 'object': return prop.rawType || 'serde_json::Value';
    case 'array': return `Vec<${prop.itemType ? getRustTypeNoOpt(prop.itemType) : 'serde_json::Value'}>`;
    case 'null':
    case 'any':
    default: return 'serde_json::Value';
  }
}
