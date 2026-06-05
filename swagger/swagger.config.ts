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
            type: { type: 'string', enum: ['GALLERY', 'STUDIO', 'CULTURAL_SPACE'] },
            address: { type: 'string' },
            area: { type: 'string', enum: ['ISLAND', 'MAINLAND', 'OTHER'] },
            lat: { type: 'number' },
            lng: { type: 'number' },
            images: { type: 'array', items: { type: 'string' } },
            website: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            openingHours: { type: 'object', nullable: true },
            tags: { type: 'array', items: { type: 'string' } },
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
            type: { type: 'string', enum: ['GALLERY', 'STUDIO', 'CULTURAL_SPACE'] },
            address: { type: 'string' },
            area: { type: 'string', enum: ['ISLAND', 'MAINLAND', 'OTHER'] },
            lat: { type: 'number', example: 6.4541 },
            lng: { type: 'number', example: 3.3947 },
            website: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string', format: 'email' },
            openingHours: {
              type: 'object',
              additionalProperties: { type: 'string' },
              example: { mon: '9am-5pm', tue: '9am-5pm' },
            },
            tags: { type: 'array', items: { type: 'string' } },
            isPublished: { type: 'boolean' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            fullName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN'] },
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
