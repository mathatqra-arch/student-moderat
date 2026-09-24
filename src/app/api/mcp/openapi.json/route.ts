import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  const openApiSpec = {
    openapi: "3.0.1",
    info: {
      title: "منصة إدارة الدفعة الأكاديمية API - ChatGPT MCP Actions",
      description: "واجهة برمجة التطبيقات المعتمدة لشات جي بي تي لإدارة استفسارات الدفعة والإعلانات",
      version: "v1.0.0"
    },
    servers: [
      {
        url: `${baseUrl}/api`
      }
    ],
    paths: {
      "/mcp": {
        post: {
          summary: "تنفيذ أوامر واستفسارات MCP شات جي بي تي",
          operationId: "executeMcpCommand",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    jsonrpc: { type: "string", example: "2.0" },
                    method: { type: "string", example: "tools/call" },
                    params: { type: "object" },
                    id: { type: "integer", example: 1 }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "نجاح استجابة JSON-RPC",
              content: {
                "application/json": {
                  schema: { type: "object" }
                }
              }
            },
            "401": {
              description: "فشل التحقق من مفتاح API Key الخاص بشات جي بي تي"
            }
          },
          security: [
            { OAuth2: [] },
            { BearerAuth: [] }
          ]
        }
      }
    },
    components: {
      securitySchemes: {
        OAuth2: {
          type: "oauth2",
          description: "نافذة مصادقة منصة الدفعة لشات جي بي تي",
          flows: {
            authorizationCode: {
              authorizationUrl: `${baseUrl}/api/mcp/oauth/authorize`,
              tokenUrl: `${baseUrl}/api/mcp/oauth/token`,
              scopes: {}
            }
          }
        },
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key (bmp_key_...)"
        }
      }
    }
  };

  return NextResponse.json(openApiSpec);
}
