CREATE DATABASE IF NOT EXISTS pristine_homes CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pristine_homes;

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
('regular','Limpieza de casa','Mantenimiento regular',35.00),
('profunda','Limpieza profunda','Detalle a fondo',50.00),
('preparacion','Limpieza de preparación','Antes de evento/entrega',45.00),
('mudanza','Limpieza de mudanza','Entrada/Salida',55.00),
('apartamento','Limpieza de apartamentos','Eficiente y ágil',30.00),
('oficina','Limpieza de oficina','Ambiente productivo',40.00)
ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), base_price=VALUES(base_price);

-- BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  service_id BIGINT UNSIGNED NOT NULL,
  beds INT NOT NULL DEFAULT 0,
  baths INT NOT NULL DEFAULT 1,
  freq ENUM('una-vez','semanal','quincenal','mensual') NOT NULL DEFAULT 'una-vez',
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