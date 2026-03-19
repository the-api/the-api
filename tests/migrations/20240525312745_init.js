exports.up = async (knex) => {
  if (!(await knex.schema.hasTable('testTypes'))) {
    await knex.schema.createTable('testTypes', (table) => {
      table.increments('id');
      table.string('name').notNullable();
    });
  }

  if (!(await knex.schema.hasTable('testTypesUsers'))) {
    await knex.schema.createTable('testTypesUsers', (table) => {
      table.increments('id');
      table.string('name').notNullable();
      table.integer('userId');
    });
  }

  if (!(await knex.schema.hasTable('testTypeAges'))) {
    await knex.schema.createTable('testTypeAges', (table) => {
      table.increments('id');
      table.integer('typeId')
        .references('id')
        .inTable('testTypes')
        .onUpdate('CASCADE')
        .onDelete('CASCADE');
      table.string('age').notNullable();
    });
  }

  if (!(await knex.schema.hasTable('testNews'))) {
    await knex.schema.createTable('testNews', (table) => {
      table.increments('id');
      table.timestamp('timeCreated').notNullable().defaultTo(knex.fn.now());
      table.timestamp('timeUpdated').nullable();
      table.timestamp('timePublished').nullable();
      table.timestamp('timeDeleted').nullable();
      table.boolean('isDeleted').defaultTo(false);
      table.string('name').notNullable();
      table.integer('typeId')
        .references('id')
        .inTable('testTypes')
        .onUpdate('CASCADE')
        .onDelete('SET NULL');
      table.integer('views').defaultTo(0);
      table.integer('userId');
    });
  }

  if (!(await knex.schema.hasTable('messages'))) {
    await knex.schema.createTable('messages', (table) => {
      table.increments('id').primary();
      table.timestamp('timeCreated').notNullable().defaultTo(knex.fn.now());
      table.integer('warningLevel').notNullable().checkBetween([0, 5]);
      table.string('body').notNullable();
      table.boolean('isDeleted').defaultTo(false);
    });
  }

  if (!(await knex.schema.hasTable('messagesOwned'))) {
    await knex.schema.createTable('messagesOwned', (table) => {
      table.increments('id').primary();
      table.timestamp('timeCreated').notNullable().defaultTo(knex.fn.now());
      table.integer('userId').notNullable();
      table.integer('warningLevel').notNullable().checkBetween([0, 5]);
      table.string('body').notNullable();
      table.boolean('isDeleted').defaultTo(false);
    });
  }
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('messagesOwned');
  await knex.schema.dropTableIfExists('messages');
  await knex.schema.dropTableIfExists('testNews');
  await knex.schema.dropTableIfExists('testTypeAges');
  await knex.schema.dropTableIfExists('testTypes');
};
