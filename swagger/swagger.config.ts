import swaggerJsdoc from 'swagger-jsdoc';
import { env } from '../src/config/env';

/**
 * OpenAPI 3.0 spec. Route documentation lives in JSDoc @swagger blocks next to
 * each route (src/routes/*.ts); reusable schemas/security are defined here.
 */
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Art Explore API',
      version: '1.0.0',
      description:
        'Backend API for Art Explore — a gallery discovery and mapping platform for Lagos.',
    },
    servers: [{ url: `http://localhost:${env.PORT}`, description: 'Local development' }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Success' },
            data: { type: 'object', nullable: true },
            pagination: {
              type: 'object',
              nullable: true,
              properties: {
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 20 },
                total: { type: 'integer', example: 90 },
                totalPages: { type: 'integer', example: 5 },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Validation failed' },
            errors: { type: 'object', nullable: true },
          },
        },
        Institution: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            type: {
              type: 'string',
              enum: [
                'ART_GALLERY',
                'MUSEUM',
                'INSTITUTE',
                'FOUNDATION',
                'STUDIO',
                'CULTURAL_SPACE',
              ],
            },
            address: { type: 'string' },
            area: { type: 'string', enum: ['ISLAND', 'MAINLAND', 'OTHER'] },
            lat: { type: 'number' },
            lng: { type: 'number' },
            images: { type: 'array', items: { type: 'string' } },
            website: { type: 'string', nullable: true },
            instagram: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            openingHours: { type: 'object', nullable: true },
            subCategoryId: { type: 'string', nullable: true },
            subCategory: { $ref: '#/components/schemas/SubCategory', nullable: true },
            tags: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
            hasExhibition: { type: 'boolean' },
            approvalStatus: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'REJECTED'],
            },
            submittedById: { type: 'string', nullable: true },
            reviewedById: { type: 'string', nullable: true },
            reviewNote: { type: 'string', nullable: true },
            reviewedAt: { type: 'string', format: 'date-time', nullable: true },
            isPublished: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        InstitutionInput: {
          type: 'object',
          required: ['name', 'type', 'address', 'area', 'lat', 'lng'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            type: {
              type: 'string',
              enum: [
                'ART_GALLERY',
                'MUSEUM',
                'INSTITUTE',
                'FOUNDATION',
                'STUDIO',
                'CULTURAL_SPACE',
              ],
            },
            address: { type: 'string' },
            area: { type: 'string', enum: ['ISLAND', 'MAINLAND', 'OTHER'] },
            lat: { type: 'number', example: 6.4541 },
            lng: { type: 'number', example: 3.3947 },
            website: { type: 'string' },
            instagram: { type: 'string', example: '@artexplorelagos' },
            phone: { type: 'string' },
            email: { type: 'string', format: 'email' },
            openingHours: {
              type: 'object',
              additionalProperties: { type: 'string' },
              example: { mon: '9am-5pm', tue: '9am-5pm' },
            },
            subCategoryId: { type: 'string' },
            tagIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs of existing Tag records to attach',
            },
            isPublished: { type: 'boolean' },
          },
        },
        SubCategory: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            type: {
              type: 'string',
              enum: [
                'ART_GALLERY',
                'MUSEUM',
                'INSTITUTE',
                'FOUNDATION',
                'STUDIO',
                'CULTURAL_SPACE',
              ],
            },
            description: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        SubCategoryInput: {
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name: { type: 'string' },
            type: {
              type: 'string',
              enum: [
                'ART_GALLERY',
                'MUSEUM',
                'INSTITUTE',
                'FOUNDATION',
                'STUDIO',
                'CULTURAL_SPACE',
              ],
            },
            description: { type: 'string' },
          },
        },
        Tag: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', description: 'Machine slug, e.g. WOMEN_OWNED' },
            label: { type: 'string', description: 'Display label, e.g. Women Owned' },
            category: {
              type: 'string',
              enum: ['OWNERSHIP', 'STYLE', 'CURATION', 'FORMAT'],
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        TagInput: {
          type: 'object',
          required: ['name', 'category'],
          properties: {
            name: { type: 'string' },
            label: { type: 'string', description: 'Defaults to name if omitted' },
            category: {
              type: 'string',
              enum: ['OWNERSHIP', 'STYLE', 'CURATION', 'FORMAT'],
            },
          },
        },
        Exhibition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            institutionId: { type: 'string' },
            name: { type: 'string' },
            images: { type: 'array', items: { type: 'string' } },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            startTime: { type: 'string', example: '10:00' },
            endTime: { type: 'string', example: '18:00' },
            link: { type: 'string', nullable: true },
            description: { type: 'string', nullable: true },
            approvalStatus: {
              type: 'string',
              enum: ['PENDING', 'APPROVED', 'REJECTED'],
            },
            submittedById: { type: 'string', nullable: true },
            approvedById: { type: 'string', nullable: true },
            approvedAt: { type: 'string', format: 'date-time', nullable: true },
            reviewNote: { type: 'string', nullable: true },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ExhibitionInput: {
          type: 'object',
          required: ['name', 'startDate', 'endDate', 'startTime', 'endTime'],
          properties: {
            name: { type: 'string' },
            images: { type: 'array', items: { type: 'string', format: 'uri' } },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            startTime: { type: 'string', example: '10:00' },
            endTime: { type: 'string', example: '18:00' },
            link: { type: 'string', format: 'uri' },
            description: { type: 'string' },
          },
        },
        ExhibitionSubmissionInput: {
          type: 'object',
          required: ['institutionId', 'name', 'startDate', 'endDate', 'startTime', 'endTime'],
          properties: {
            institutionId: {
              type: 'string',
              description: 'The published venue this exhibition belongs to.',
            },
            name: { type: 'string' },
            images: { type: 'array', items: { type: 'string', format: 'uri' } },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            startTime: { type: 'string', example: '10:00' },
            endTime: { type: 'string', example: '18:00' },
            link: { type: 'string', format: 'uri' },
            description: { type: 'string' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            fullName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'USER'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  // Resolve route files relative to the project root (works for ts-node & dist).
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
