import sqlite3
import os
import sys

def init_database(db_path=None):
    if db_path is None:
        db_path = os.path.join(os.path.dirname(__file__), 'estrely.db')
    
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    
    os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else '.', exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    
    with open(schema_path, 'r') as f:
        conn.executescript(f.read())
    
    conn.commit()
    conn.close()
    print(f'Database initialized at {db_path}')

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else None
    init_database(path)
