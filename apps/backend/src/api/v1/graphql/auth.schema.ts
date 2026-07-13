import {
  createUserSchema,
  loginSchema,
  type AuthResponse,
  type PublicUser,
} from "@repo/shared";
import { builder, requireActor, type GraphQLContext } from "./builder";
import { RoleEnum } from "./enums";

export const UserType = builder.objectRef<PublicUser>("User").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    email: t.exposeString("email"),
    name: t.exposeString("name"),
    role: t.field({ type: RoleEnum, resolve: (user) => user.role }),
    createdAt: t.exposeString("createdAt"),
  }),
});

const AuthPayload = builder.objectRef<AuthResponse>("AuthPayload").implement({
  fields: (t) => ({
    token: t.exposeString("token"),
    user: t.field({ type: UserType, resolve: (payload) => payload.user }),
  }),
});

builder.queryFields((t) => ({
  me: t.field({
    type: UserType,
    description: "The currently authenticated user.",
    resolve: async (_root, _args, context: GraphQLContext) => {
      const actor = requireActor(context);
      return context.services.auth.getCurrentUser(actor.id);
    },
  }),
}));

builder.mutationFields((t) => ({
  login: t.field({
    type: AuthPayload,
    args: {
      email: t.arg.string({ required: true }),
      password: t.arg.string({ required: true }),
    },
    resolve: (_root, args, context: GraphQLContext) =>
      context.services.auth.login(loginSchema.parse(args)),
  }),

  register: t.field({
    type: AuthPayload,
    args: {
      email: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
      password: t.arg.string({ required: true }),
      role: t.arg({ type: RoleEnum, required: false }),
    },
    resolve: (_root, args, context: GraphQLContext) =>
      context.services.auth.register(
        createUserSchema.parse({
          email: args.email,
          name: args.name,
          password: args.password,
          ...(args.role ? { role: args.role } : {}),
        }),
      ),
  }),
}));
