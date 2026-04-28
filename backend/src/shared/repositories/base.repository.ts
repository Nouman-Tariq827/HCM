import { Repository, DataSource, FindOptionsWhere, FindManyOptions, DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

/**
 * Base Repository
 * 
 * Provides common database operations with proper error handling and logging.
 * All repositories should extend this base class for consistency.
 * 
 * Why this exists:
 * - Centralizes common database operations
 * - Provides consistent error handling
 * - Enables performance monitoring
 * - Reduces code duplication across repositories
 */
export abstract class BaseRepository<T> {
  protected readonly repository: Repository<T>;
  protected readonly entityName: string;

  constructor(
    protected readonly dataSource: DataSource,
    entity: new () => T,
    entityName: string
  ) {
    this.repository = dataSource.getRepository(entity);
    this.entityName = entityName;
  }

  /**
   * Find a single entity by conditions
   * @param where - Find conditions
   * @returns Entity or null if not found
   */
  async findOne(where: FindOptionsWhere<T>): Promise<T | null> {
    try {
      return await this.repository.findOne({ where });
    } catch (error) {
      this.handleDatabaseError('findOne', error, { where });
      return null;
    }
  }

  /**
   * Find multiple entities by conditions
   * @param options - Find options
   * @returns Array of entities
   */
  async findMany(options?: FindManyOptions<T>): Promise<T[]> {
    try {
      return await this.repository.find(options);
    } catch (error) {
      this.handleDatabaseError('findMany', error, { options });
      return [];
    }
  }

  /**
   * Find entity by primary key
   * @param id - Primary key
   * @returns Entity or null if not found
   */
  async findById(id: any): Promise<T | null> {
    try {
      return await this.repository.findOne({ where: { id } as any });
    } catch (error) {
      this.handleDatabaseError('findById', error, { id });
      return null;
    }
  }

  /**
   * Save an entity
   * @param entity - Entity to save
   * @returns Saved entity
   */
  async save(entity: T): Promise<T> {
    try {
      return await this.repository.save(entity);
    } catch (error) {
      this.handleDatabaseError('save', error, { entity });
      throw error;
    }
  }

  /**
   * Create a new entity
   * @param data - Entity data
   * @returns Created entity
   */
  async create(data: DeepPartial<T>): Promise<T> {
    try {
      const entity = this.repository.create(data);
      return await this.repository.save(entity);
    } catch (error) {
      this.handleDatabaseError('create', error, { data });
      throw error;
    }
  }

  /**
   * Create multiple entities
   * @param dataArray - Array of entity data
   * @returns Created entities
   */
  async createMany(dataArray: DeepPartial<T>[]): Promise<T[]> {
    try {
      const entities = this.repository.create(dataArray);
      return await this.repository.save(entities);
    } catch (error) {
      this.handleDatabaseError('createMany', error, { count: dataArray.length });
      throw error;
    }
  }

  /**
   * Update an entity
   * @param id - Primary key
   * @param data - Update data
   * @returns Updated entity or null if not found
   */
  async update(id: any, data: QueryDeepPartialEntity<T>): Promise<T | null> {
    try {
      await this.repository.update(id, data);
      return await this.findById(id);
    } catch (error) {
      this.handleDatabaseError('update', error, { id, data });
      throw error;
    }
  }

  /**
   * Update entities by conditions
   * @param where - Update conditions
   * @param data - Update data
   * @returns Number of affected rows
   */
  async updateMany(where: FindOptionsWhere<T>, data: QueryDeepPartialEntity<T>): Promise<number> {
    try {
      const result = await this.repository.update(where, data);
      return result.affected || 0;
    } catch (error) {
      this.handleDatabaseError('updateMany', error, { where, data });
      throw error;
    }
  }

  /**
   * Delete an entity
   * @param id - Primary key
   * @returns True if deleted, false if not found
   */
  async delete(id: any): Promise<boolean> {
    try {
      const result = await this.repository.delete(id);
      return (result.affected || 0) > 0;
    } catch (error) {
      this.handleDatabaseError('delete', error, { id });
      throw error;
    }
  }

  /**
   * Delete entities by conditions
   * @param where - Delete conditions
   * @returns Number of affected rows
   */
  async deleteMany(where: FindOptionsWhere<T>): Promise<number> {
    try {
      const result = await this.repository.delete(where);
      return result.affected || 0;
    } catch (error) {
      this.handleDatabaseError('deleteMany', error, { where });
      throw error;
    }
  }

  /**
   * Count entities by conditions
   * @param where - Count conditions
   * @returns Number of entities
   */
  async count(where?: FindOptionsWhere<T>): Promise<number> {
    try {
      return await this.repository.count({ where });
    } catch (error) {
      this.handleDatabaseError('count', error, { where });
      return 0;
    }
  }

  /**
   * Check if entity exists by conditions
   * @param where - Existence conditions
   * @returns True if exists, false otherwise
   */
  async exists(where: FindOptionsWhere<T>): Promise<boolean> {
    try {
      const count = await this.repository.count({ where });
      return count > 0;
    } catch (error) {
      this.handleDatabaseError('exists', error, { where });
      return false;
    }
  }

  /**
   * Execute a raw SQL query
   * @param query - SQL query string
   * @param parameters - Query parameters
   * @returns Query results
   */
  async query(query: string, parameters?: any[]): Promise<any> {
    try {
      return await this.repository.query(query, parameters);
    } catch (error) {
      this.handleDatabaseError('query', error, { query, parameters });
      throw error;
    }
  }

  /**
   * Execute operation within a transaction
   * @param operation - Operation to execute
   * @returns Operation result
   */
  async withTransaction<R>(operation: (manager: any) => Promise<R>): Promise<R> {
    try {
      return await this.dataSource.transaction(operation);
    } catch (error) {
      this.handleDatabaseError('withTransaction', error);
      throw error;
    }
  }

  /**
   * Find entities with pagination
   * @param options - Find options with pagination
   * @returns Paginated result
   */
  async findWithPagination(
    options: FindManyOptions<T> & { page: number; limit: number }
  ): Promise<{ data: T[]; total: number; page: number; limit: number; totalPages: number }> {
    try {
      const { page, limit, ...findOptions } = options;
      const skip = (page - 1) * limit;

      const [data, total] = await this.repository.findAndCount({
        ...findOptions,
        skip,
        take: limit,
      });

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.handleDatabaseError('findWithPagination', error, { options });
      throw error;
    }
  }

  /**
   * Soft delete an entity (if supported)
   * @param id - Primary key
   * @returns True if soft deleted, false if not found
   */
  async softDelete(id: any): Promise<boolean> {
    try {
      const result = await this.repository.softDelete(id);
      return (result.affected || 0) > 0;
    } catch (error) {
      this.handleDatabaseError('softDelete', error, { id });
      throw error;
    }
  }

  /**
   * Restore a soft deleted entity (if supported)
   * @param id - Primary key
   * @returns True if restored, false if not found
   */
  async restore(id: any): Promise<boolean> {
    try {
      const result = await this.repository.restore(id);
      return (result.affected || 0) > 0;
    } catch (error) {
      this.handleDatabaseError('restore', error, { id });
      throw error;
    }
  }

  /**
   * Handle database errors consistently
   * @param operation - Operation that failed
   * @param error - Error object
   * @param context - Additional context for logging
   */
  private handleDatabaseError(operation: string, error: any, context?: any): void {
    const errorMessage = `Database operation '${operation}' failed for entity '${this.entityName}'`;
    const errorContext = context ? JSON.stringify(context) : 'no context';
    
    // Log the error with full context
    console.error(`${errorMessage}: ${error.message}`, {
      entity: this.entityName,
      operation,
      error: error.message,
      stack: error.stack,
      context: errorContext,
    });

    // Re-throw with additional context
    const enhancedError = new Error(`${errorMessage}: ${error.message}`);
    (enhancedError as any).originalError = error;
    (enhancedError as any).context = context;
    
    throw enhancedError;
  }

  /**
   * Get repository statistics for monitoring
   * @returns Repository statistics
   */
  async getStatistics(): Promise<{ totalRecords: number; lastUpdated?: Date }> {
    try {
      const totalRecords = await this.count();
      
      // Try to get the most recent record's updated timestamp
      const latestRecord = await this.repository.findOne({
        order: { updatedAt: 'DESC' } as any,
        select: ['updatedAt'] as any,
      });

      return {
        totalRecords,
        lastUpdated: (latestRecord as any)?.updatedAt || (latestRecord as any)?.createdAt,
      };
    } catch (error) {
      this.handleDatabaseError('getStatistics', error);
      return { totalRecords: 0 };
    }
  }

  /**
   * Validate entity data before database operations
   * @param data - Entity data to validate
   * @throws Error if validation fails
   */
  protected validateEntity(data: any): void {
    if (!data) {
      throw new Error('Entity data is required');
    }
    
    // Override in subclasses for specific validation
  }

  /**
   * Transform entity data before database operations
   * @param data - Entity data to transform
   * @returns Transformed data
   */
  protected transformData(data: any): any {
    // Override in subclasses for specific transformations
    return data;
  }
}
