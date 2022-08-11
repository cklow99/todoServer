import { ApolloServer, gql } from "apollo-server-express";
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageLocalDefault,
} from "apollo-server-core";
import express from "express";
import http from "http";
import { Sequelize, DataTypes } from "sequelize";
import { nanoid } from "nanoid";

(async () => {
  const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: "todo.db",
    define: {
      freezeTableName: true,
    },
  });

  try {
    await sequelize.authenticate();
    console.log("Connection has been established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }

  const Todo = sequelize.define("todo", {
    id: { type: DataTypes.STRING, primaryKey: true },
    text: DataTypes.STRING,
    status: DataTypes.STRING,
    update_ctr: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
  });

  await Todo.sync();

  const typeDefs = gql`
    type Todo {
      id: String
      text: String
      status: String
      update_ctr: Int
    }

    type Query {
      todo(id: String!): Todo
      todos: [Todo]
    }

    type Mutation {
      addTodo(text: String): Todo
      updateTodo(
        id: String!
        update_ctr: Int!
        text: String
        status: String
      ): Todo
      deleteTodo(id: String!, update_ctr: Int!): Boolean
    }
  `;

  // Resolvers define the technique for fetching the types defined in the
  // schema. This resolver retrieves books from the "books" array above.
  const resolvers = {
    Query: {
      todos: async () => await Todo.findAll(),
      todo: async (parent, args, context, info) =>
        await Todo.findOne({ where: { id: args.id } }),
    },

    Mutation: {
      addTodo: async (parent, args, context, info) => {
        return await Todo.create({
          id: nanoid(),
          text: args.text,
          status: "ACTIVE",
        });
      },
      updateTodo: async (parent, args, context, info) => {
        const retVal = await Todo.update(
          {
            update_ctr: Sequelize.literal("update_ctr + 1"),
            ...(args.text && { text: args.text }),
            ...(args.status && { status: args.status }),
          },
          {
            where: {
              id: args.id,
              update_ctr: args.update_ctr,
            },
          }
        );

        if (retVal) {
          return await Todo.findOne({ where: { id: args.id } });
        }
        return null;
      },
      deleteTodo: async (parent, args, context, info) => {
        const _todo = await Todo.destroy({
          where: { id: args.id, update_ctr: args.update_ctr },
        });
        return _todo === 1;
      },
    },
  };

  // Required logic for integrating with Express
  const app = express();
  // Our httpServer handles incoming requests to our Express app.
  // Below, we tell Apollo Server to "drain" this httpServer,
  // enabling our servers to shut down gracefully.
  const httpServer = http.createServer(app);

  // Same ApolloServer initialization as before, plus the drain plugin
  // for our httpServer.
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: true,
    cache: "bounded",
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
  });

  // More required logic for integrating with Express
  await server.start();
  server.applyMiddleware({
    app,

    // By default, apollo-server hosts its GraphQL endpoint at the
    // server root. However, *other* Apollo Server packages host it at
    // /graphql. Optionally provide this to match apollo-server.
    path: "/",
  });

  // Modified server startup
  await new Promise((resolve) => httpServer.listen({ port: 4000 }, resolve));
  console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
})();
