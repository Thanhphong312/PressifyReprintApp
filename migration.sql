-- Pressify Reprint - Database Migration
-- Run this SQL on the existing pressify database:
--   mysql -u root pressify < migration.sql
-- Note: users and roles tables already exist, only reprint-related tables are created here.

CREATE TABLE IF NOT EXISTS order_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reason_reprints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_variants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  color VARCHAR(255) DEFAULT '',
  size VARCHAR(255) DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reprints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  support_id INT,
  order_id VARCHAR(255) DEFAULT '',
  link_id VARCHAR(500) DEFAULT '',
  reason_reprint_id INT,
  order_type_id INT,
  note TEXT,
  product_variant_id INT,
  brand VARCHAR(255) DEFAULT '',
  machine_number VARCHAR(100) DEFAULT '',
  user_error_id INT,
  reason_error TEXT,
  user_note TEXT,
  status VARCHAR(50) DEFAULT 'not_yet',
  finished_date VARCHAR(100) DEFAULT '',
  created_at BIGINT,
  updated_at BIGINT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS timelines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  reprint_id INT,
  note TEXT,
  time_vn VARCHAR(50) DEFAULT '',
  time_us VARCHAR(50) DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
