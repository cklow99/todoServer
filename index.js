import { ApolloServer, gql } from 'apollo-server-express';
import { ApolloServerPluginDrainHttpServer, ApolloServerPluginLandingPageLocalDefault } from 'apollo-server-core';
import express from 'express';
import http from 'http';
import { Sequelize, DataTypes } from 'sequelize';
import { nanoid } from 'nanoid'

(async () => {
    const sequelize = new Sequelize(
        {
            dialect: 'sqlite',
            storage: 'todo.db',
            define: {
                freezeTableName: true
            }
        }
    );

    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }

    const Todo = sequelize.define('todo', {
        id: { type: DataTypes.STRING, primaryKey: true },
        text: DataTypes.STRING,
        status: DataTypes.STRING,
    });

    await Todo.sync();

    const typeDefs = gql`
        type Todo {
            id: String
            text: String
            status: String
        }

        type Query {
            todo(id: String!): Todo,
            todos: [Todo],
        }

        type Mutation {
            addTodo(text: String): Todo,
            updateTodo(id: String!, text: String, status: String): Todo,
            deleteTodo(id: String!): Boolean
        }
    `;

    // Resolvers define the technique for fetching the types defined in the
    // schema. This resolver retrieves books from the "books" array above.
    const resolvers = {
        Query: {
            todos: async () => await Todo.findAll(),
            todo: async (parent, args, context, info) => await Todo.findOne({ where: { id: args.id } }),
        },

        Mutation: {
            addTodo: async (parent, args, context, info) => await Todo.create({ id: nanoid(), text: args.text, status: 'ACTIVE' }),
            updateTodo: async (parent, args, context, info) => {
                const _todo = await Todo.findOne({ where: { id: args.id } })
                if (_todo) {
                    console.log('todo: ', JSON.parse(JSON.stringify(_todo)));
                    return await _todo.update({ ...(args.text && { 'text': args.text }), ...(args.status && { 'status': args.status }) });
                }
                return null
            },
            deleteTodo: async (parent, args, context, info) => {
                const _todo = await Todo.findOne({ where: { id: args.id } })
                if (_todo) {
                    console.log('todo: ', JSON.parse(JSON.stringify(_todo)));
                    return typeof (await _todo.destroy()) === 'object';
                }
                return false
            }
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
        cache: 'bounded',
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
        path: '/',
    });

    // Modified server startup
    await new Promise(resolve => httpServer.listen({ port: 4000 }, resolve));
    console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`);
})();