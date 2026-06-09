-- =============================================================================
-- SCRIPT DE CREACIÓN DE BASE DE DATOS - PROYECTO ABITIA (FASE MAGRA)
-- MOTOR: MySQL 8.0+ / InnoDB
-- =============================================================================

CREATE DATABASE IF NOT EXISTS abitia_core CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE abitia_core;

-- =============================================================================
-- 1. TABLA NÚCLEO: CONDOMINIO (TENANTS)
-- =============================================================================
CREATE TABLE Condominio (
    IdCondominio INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(120) NOT NULL,
    Rif_IdFiscal VARCHAR(50) NOT NULL UNIQUE,
    Direccion TEXT NOT NULL,
    Subdominio_Slug VARCHAR(50) NOT NULL UNIQUE,
    Porcentaje_Fondo_Reserva DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- Columna previsora Fase 2
    Configuracion_JSON JSON NULL,
    Fecha_Creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================================================
-- 2. TABLA: USUARIO GLOBAL
-- =============================================================================
CREATE TABLE Usuario (
    IdUsuario INT AUTO_INCREMENT PRIMARY KEY,
    Nombre VARCHAR(80) NOT NULL,
    Apellido VARCHAR(80) NOT NULL,
    Email VARCHAR(100) NOT NULL UNIQUE,
    Password_Hash VARCHAR(255) NOT NULL,
    Telefono VARCHAR(30) NULL,
    Estatus TINYINT NOT NULL DEFAULT 1, -- 1: Activo, 0: Inactivo
    Fecha_Registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================================================
-- 3. TABLA DE INTERSECCIÓN: ROLES MULTI-CONDOMINIO
-- =============================================================================
CREATE TABLE Usuario_Condominio_Rol (
    IdUsuario INT NOT NULL,
    IdCondominio INT NOT NULL,
    Rol TINYINT NOT NULL, -- 1: SuperAdmin, 2: Administrador, 3: Propietario, 4: Inquilino
    PRIMARY KEY (IdUsuario, IdCondominio),
    CONSTRAINT FK_Rol_Usuario FOREIGN KEY (IdUsuario) REFERENCES Usuario(IdUsuario) ON DELETE CASCADE,
    CONSTRAINT FK_Rol_Condominio FOREIGN KEY (IdCondominio) REFERENCES Condominio(IdCondominio) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- 4. TABLA: PROPIEDAD (INMUEBLES)
-- =============================================================================
CREATE TABLE Propiedad (
    IdPropiedad INT AUTO_INCREMENT PRIMARY KEY,
    IdCondominio INT NOT NULL,
    Codigo_Nro VARCHAR(30) NOT NULL,          -- Ej: 'APT-10A', 'CASA-12'
    Alicuota DECIMAL(10,6) NOT NULL,          -- Porcentaje de participación, ej: 0.041250
    IdPropietario_Actual INT NOT NULL,
    Estatus TINYINT NOT NULL DEFAULT 1,       -- 1: Activo, 0: Inactivo
    CONSTRAINT FK_Propiedad_Condominio FOREIGN KEY (IdCondominio) REFERENCES Condominio(IdCondominio),
    CONSTRAINT FK_Propiedad_Propietario FOREIGN KEY (IdPropietario_Actual) REFERENCES Usuario(IdUsuario),
    UNIQUE KEY UX_Condominio_Inmueble (IdCondominio, Codigo_Nro)
) ENGINE=InnoDB;

-- =============================================================================
-- 5. TABLA: GASTO_CONDOMINIO (EGRESOS MENSUALES)
-- =============================================================================
CREATE TABLE Gasto_Condominio (
    IdGasto INT AUTO_INCREMENT PRIMARY KEY,
    IdCondominio INT NOT NULL,
    Periodo_MesAnio VARCHAR(7) NOT NULL,       -- Formato: 'YYYY-MM'
    Descripcion VARCHAR(255) NOT NULL,
    Monto DECIMAL(18,2) NOT NULL,
    Tipo_Gasto TINYINT NOT NULL,               -- 1: Común (Por Alícuota), 2: No Común (Cargado directo)
    Fecha_Gasto DATE NOT NULL,
    CONSTRAINT FK_Gasto_Condominio FOREIGN KEY (IdCondominio) REFERENCES Condominio(IdCondominio)
) ENGINE=InnoDB;

-- =============================================================================
-- 6. TABLA: RECIBO_MENSUAL (CUOTAS GENERADAS)
-- =============================================================================
CREATE TABLE Recibo_Mensual (
    IdRecibo INT AUTO_INCREMENT PRIMARY KEY,
    IdPropiedad INT NOT NULL,
    Periodicidad_MesAnio VARCHAR(7) NOT NULL,
    Fecha_Emision DATE NOT NULL,
    Fecha_Vencimiento DATE NOT NULL,
    Monto_Gasto_Comun DECIMAL(18,2) NOT NULL,
    Monto_Gasto_NoComun DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    Monto_Fondo_Reserva DECIMAL(18,2) NOT NULL DEFAULT 0.00,   -- Columna previsora Fase 2
    Saldo_Anterior_Pendiente DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    Total_A_Pagar DECIMAL(18,2) NOT NULL,
    Estatus_Pago TINYINT NOT NULL DEFAULT 0,    -- 0: Pendiente, 1: Pagado, 2: Parcial
    CONSTRAINT FK_Recibo_Propiedad FOREIGN KEY (IdPropiedad) REFERENCES Propiedad(IdPropiedad)
) ENGINE=InnoDB;

-- =============================================================================
-- 7. TABLA DE CONTENCIÓN: PAGO_REPORTADO (VERIFICACIÓN ASÍNCRONA)
-- =============================================================================
CREATE TABLE Pago_Reportado (
    IdPago BIGINT AUTO_INCREMENT PRIMARY KEY,
    IdCondominio INT NOT NULL,
    IdPropiedad INT NOT NULL,
    IdUsuario_Reporta INT NOT NULL,
    Fecha_Reporte TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Monto DECIMAL(18,2) NOT NULL,
    Fecha_Transferencia DATE NOT NULL,
    Referencia_Bancaria VARCHAR(50) NOT NULL,
    IdBanco_Destino INT NOT NULL,
    Forma_Pago TINYINT NOT NULL,               -- 1: Transferencia, 2: Pago Móvil, 3: Efectivo, 4: Zelle
    Comprobante_Url VARCHAR(255) NULL,
    Observaciones_User VARCHAR(255) NULL,
    Estatus_Verificacion TINYINT NOT NULL DEFAULT 0, -- 0: Pendiente, 1: Aprobado, 2: Rechazado
    Fecha_Verificacion DATETIME NULL,
    IdUsuario_Verifica INT NULL,
    Motivo_Rechazo VARCHAR(255) NULL,
    CONSTRAINT FK_Pago_Condominio FOREIGN KEY (IdCondominio) REFERENCES Condominio(IdCondominio),
    CONSTRAINT FK_Pago_Propiedad FOREIGN KEY (IdPropiedad) REFERENCES Propiedad(IdPropiedad),
    CONSTRAINT FK_Pago_Usuario FOREIGN KEY (IdUsuario_Reporta) REFERENCES Usuario(IdUsuario),
    CONSTRAINT FK_Pago_Admin FOREIGN KEY (IdUsuario_Verifica) REFERENCES Usuario(IdUsuario)
) ENGINE=InnoDB;

-- =============================================================================
-- 8. TABLA CONTABLE NÚCLEO: CUENTA_CORRIENTE_PROPIEDAD (LEDGER INMUTABLE)
-- =============================================================================
CREATE TABLE Cuenta_Corriente_Propiedad (
    IdMovimiento BIGINT AUTO_INCREMENT PRIMARY KEY,
    IdCondominio INT NOT NULL,
    IdPropiedad INT NOT NULL,
    Fecha_Movimiento DATETIME NOT NULL,
    Tipo_Movimiento TINYINT NOT NULL,          -- 1: Recibo Emitido, 2: Pago Aplicado, 3: Nota Crédito, 4: Nota Débito
    IdReferencia_Origen INT NOT NULL,          -- Enlace al IdRecibo o IdPago
    Descripcion VARCHAR(150) NOT NULL,
    Monto DECIMAL(18,2) NOT NULL,
    Saldo_Resultante DECIMAL(18,2) NOT NULL,
    CONSTRAINT FK_Ledger_Condominio FOREIGN KEY (IdCondominio) REFERENCES Condominio(IdCondominio),
    CONSTRAINT FK_Ledger_Propiedad FOREIGN KEY (IdPropiedad) REFERENCES Propiedad(IdPropiedad)
) ENGINE=InnoDB;

-- =============================================================================
-- ÍNDICES COMPUESTOS CRÍTICOS PARA ALTA DENSIDAD Y ESCALA MULTI-TENANT
-- =============================================================================
CREATE INDEX IX_Condominio_Slug ON Condominio (Subdominio_Slug);
CREATE INDEX IX_Propiedad_FiltroCore ON Propiedad (IdCondominio, IdPropiedad);
CREATE INDEX IX_Gasto_Mes ON Gasto_Condominio (IdCondominio, Periodo_MesAnio);
CREATE INDEX IX_Recibo_Pendiente ON Recibo_Mensual (IdPropiedad, Estatus_Pago);
CREATE INDEX IX_Pago_BandejaVerificar ON Pago_Reportado (IdCondominio, Estatus_Verificacion, Fecha_Reporte DESC);
CREATE UNIQUE INDEX UX_Pago_PrevencionFraude ON Pago_Reportado (IdCondominio, Referencia_Bancaria);
CREATE INDEX IX_Ledger_Historico_Instantaneo ON Cuenta_Corriente_Propiedad (IdCondominio, IdPropiedad, IdMovimiento DESC);
