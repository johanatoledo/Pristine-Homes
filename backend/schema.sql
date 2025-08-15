CREATE DATABASE IF NOT EXISTS pristineHomes CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pristineHomes;

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  phone VARCHAR(40) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- SERVICES
CREATE TABLE IF NOT EXISTS services (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(32) NOT NULL UNIQUE,    -- regular, profunda, preparacion, mudanza, apartamento, oficina
  name VARCHAR(120) NOT NULL,
  description TEXT,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 35.00,
  active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

INSERT INTO services (code,name,description,base_price) VALUES
('Regular', 'House Cleaning', 'Regular Maintenance',35.00),
('Deep', 'Deep Cleaning', 'Deep Detail',50.00),
('Preparation', 'Preparation Cleaning', 'Before event/delivery',45.00),
('MovingOut', 'Move-In Cleaning', 'Move-In/Move-Out',55.00),
('Apartment', 'Apartment cleaning', 'Efficient and agile',30.00),
('Office', 'Office cleaning', 'Productive environment',40.00)
ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), base_price=VALUES(base_price);

-- BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  service_id BIGINT UNSIGNED NOT NULL,
  beds INT NOT NULL DEFAULT 0,
  baths INT NOT NULL DEFAULT 1,
  freq ENUM('Once', 'Weekly', 'Biweekly', 'Monthly') NOT NULL DEFAULT 'once',
  extras JSON NULL,                      -- ["ventanas","horno",...]
  date DATE NOT NULL,
  time TIME NOT NULL,
  address VARCHAR(255) NOT NULL,
  zip VARCHAR(16) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  status ENUM('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_bookings_service FOREIGN KEY (service_id) REFERENCES services(id),
  INDEX idx_bookings_user (user_id),
  INDEX idx_bookings_date (date)
) ENGINE=InnoDB;

-- PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  booking_id BIGINT UNSIGNED NOT NULL,
  provider ENUM('stripe','mercadopago') NOT NULL,
  external_id VARCHAR(191) NOT NULL,     -- payment_intent/charge id o preference/collection id
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  status VARCHAR(32) NOT NULL,           -- requires_payment_method, succeeded, approved, etc.
  raw JSON NULL,                         -- payload de proveedor
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
  UNIQUE KEY uniq_provider_external (provider, external_id)
) ENGINE=InnoDB;