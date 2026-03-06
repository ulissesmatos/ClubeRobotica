import { FastifyRequest, FastifyReply } from "fastify";

// Estende o namespace do Fastify para incluir o payload do JWT
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { adminId: number; email: string };
    user: { adminId: number; email: string };
  }
}

export interface AdminJWTPayload {
  adminId: number;
  email: string;
}

export type FastifyRequestWithAdmin = FastifyRequest & {
  user: AdminJWTPayload;
};

export type RouteHandler<
  Params = unknown,
  Body = unknown,
  Querystring = unknown
> = (
  request: FastifyRequest<{
    Params: Params;
    Body: Body;
    Querystring: Querystring;
  }>,
  reply: FastifyReply
) => Promise<void>;
