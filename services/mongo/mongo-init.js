db.createUser({
  user: 'rsuser',
  pwd: process.env.MONGODB_RSUSER_PASSWORD,
  roles: [
      {
          role: 'readWrite',
          db: 'rsdb',
      },
  ],
});
