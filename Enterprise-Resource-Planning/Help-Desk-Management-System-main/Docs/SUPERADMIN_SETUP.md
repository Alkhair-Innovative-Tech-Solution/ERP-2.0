# Django Superadmin Creation Guide

## Overview
The HDMS system uses a **unified superadmin** that can log into all backend services (user-service, ticket-service, communication-service, file-service).

## Superadmin Features
- **Auto-generated Employee Code**: Pattern `S-YY-####`
  - `S` = Superadmin
  - `YY` = 2-digit year of creation (e.g., 25 for 2025)
  - `####` = Zero-padded serial number (0001, 0002, etc.)
- **Additional Information**: CNIC and Phone Number
- **Shared Across Services**: Same credentials work on all service admin panels

## Environment Variables

Set these environment variables before creating a superadmin:

```bash
# Required
SUPERADMIN_PASSWORD=SecurePassword123

# Optional (with defaults)
SUPERADMIN_FIRST_NAME=Admin        # Default: Admin
SUPERADMIN_LAST_NAME=User          # Default: User
SUPERADMIN_EMAIL=admin@hdms.com    # Default: admin@hdms.com
SUPERADMIN_CNIC=1234567890123      # Optional
SUPERADMIN_PHONE=+92300123456      # Optional
```

## Creating a Superadmin

### Method 1: Using user-service
```bash
cd services/user-service/src
python create_superadmin.py
```

### Method 2: Using any other service
```bash
cd services/ticket-service/src
python create_su.py
```

Both scripts will:
1. Check if a superadmin already exists
2. If not, create one with auto-generated employee code
3. Display the created superadmin details

## Example Output

```
Creating superadmin...
✓ Superadmin created successfully!
  Employee Code: S-25-0001
  Name: Admin User
  Email: admin@hdms.com
  CNIC: 1234567890123
  Phone: +92300123456
```

## Accessing Django Admin

After creating the superadmin, you can log in to any service's admin panel:

- User Service: http://localhost:8001/admin/
- Ticket Service: http://localhost:8002/admin/
- Communication Service: http://localhost:8003/admin/
- File Service: http://localhost:8005/admin/

**Login Credentials:**
- Employee Code: `S-25-0001` (or whatever was generated)
- Password: Your `SUPERADMIN_PASSWORD` value

## Database Migrations

Before creating a superadmin, ensure migrations are applied:

```bash
cd services/user-service/src
python manage.py migrate
```

This creates the `cnic` and `phone_number` fields in the users table.

## Security Notes

1. **Never commit `.env` files** with real credentials
2. **Use strong passwords** in production
3. **Limit superadmin accounts** to essential personnel only
4. The auto-generated employee code is **unique and sequential**
