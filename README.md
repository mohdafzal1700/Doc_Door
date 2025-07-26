# Doc-Door 🏥

**A comprehensive telehealth platform connecting patients with healthcare professionals through secure virtual consultations and streamlined appointment management.**

Doc-Door bridges the gap between patients and doctors by providing an intuitive platform for discovering healthcare providers, booking appointments, and conducting secure video consultations with integrated payment processing.

## ✨ Key Features

### 🔍 Doctor Discovery & Booking
- **Smart Doctor Search**: Filter by specialty, location, availability, and patient reviews
- **Real-time Scheduling**: Instant appointment booking, rescheduling, and cancellations
- **Doctor Profiles**: Comprehensive provider information including bio, services, pricing, and availability

### 💬 Secure Consultations
- **Real-time Chat**: HIPAA-compliant messaging system
- **Video Consultations**: WebRTC-powered secure video calls
- **WebSocket Integration**: Live communication via Django Channels

### 💳 Payment Processing
- **Multiple Payment Options**: Stripe and Razorpay integration
- **Flexible Billing**: One-time payments and subscription plans
- **Secure Transactions**: PCI-compliant payment processing

### 📊 Management & Analytics
- **Admin Dashboard**: User and doctor management, review moderation
- **Analytics Dashboard**: Booking insights and performance reporting
- **Practice Management**: Doctor profile and service management tools

## 🛠 Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Backend** | Django | 5.2.1 |
| **API** | Django REST Framework | 3.16.0 |
| **Database** | PostgreSQL / SQLite | - |
| **Real-time** | Django Channels | 4.2.2 |
| **Cache/Queue** | Redis | 6.2.0 |
| **Authentication** | JWT (SimpleJWT) | 5.5.0 |
| **Media Storage** | Cloudinary | 1.44.0 |
| **Payments** | Razorpay SDK | 1.4.2 |
| **Frontend** | React (Vite) | - |
| **WebSockets** | channels-redis | 4.3.0 |

## 📁 Project Structure

```
docdoor/
├── backend/
│   ├── adminside/          # Admin dashboard & management
│   ├── backend/            # Core Django settings
│   ├── chat/               # Real-time messaging system
│   ├── doctor/             # Doctor profiles & management
│   ├── patients/           # Patient profiles & management
│   ├── db.sqlite3          # Development database
│   ├── manage.py           # Django management script
│   └── requirements.txt    # Python dependencies
├── frontend/               # React Vite application
└── env/                    # Virtual environment
```

## ⚡ Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- Redis Server
- PostgreSQL (for production)

### Backend Setup

1. **Clone and navigate to the project**
```bash
git clone <repository-url>
cd docdoor/backend
```

2. **Create virtual environment**
```bash
python -m venv env
source env/bin/activate  # On Windows: env\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Environment configuration**
```bash
cp .env.example .env
# Configure your environment variables (see .env structure below)
```

5. **Database setup**
```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

6. **Start Redis server**
```bash
redis-server
```

7. **Run development server**
```bash
python manage.py runserver
```

### Frontend Setup

1. **Navigate to frontend directory**
```bash
cd ../frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm run dev
```

## 🔌 API Endpoints

| Purpose | Endpoint | Method | Authentication |
|---------|----------|--------|----------------|
| User Registration | `/api/auth/register/` | POST | None |
| User Login | `/api/auth/login/` | POST | None |
| Doctor List | `/api/doctors/` | GET | Token |
| Doctor Detail | `/api/doctors/{id}/` | GET | Token |
| Book Appointment | `/api/appointments/` | POST | Token |
| User Appointments | `/api/appointments/user/` | GET | Token |
| Start Consultation | `/api/consultations/start/` | POST | Token |
| Payment Processing | `/api/payments/process/` | POST | Token |
| Chat Messages | `/api/chat/{room_id}/` | GET/POST | Token |
| Admin Dashboard | `/api/admin/dashboard/` | GET | Admin Token |

## 🔧 Environment Configuration

Create a `.env` file in the backend directory:

```env
# Django Settings
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/docdoor_db
# For development, Django uses SQLite by default

# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Payment Gateway Configuration
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret

# Email Configuration (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
EMAIL_USE_TLS=True

# JWT Configuration
JWT_SECRET_KEY=your-jwt-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRATION_DELTA=3600

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

## 🚀 Deployment Checklist

### Pre-deployment
- [ ] Set `DEBUG=False` in production
- [ ] Configure production database (PostgreSQL)
- [ ] Set up Redis server/cluster
- [ ] Configure Cloudinary for media storage
- [ ] Set up payment gateway webhooks
- [ ] Configure email backend
- [ ] Set secure `SECRET_KEY`
- [ ] Configure CORS for production domains

### Security
- [ ] Enable HTTPS/SSL certificates
- [ ] Configure secure headers
- [ ] Set up rate limiting
- [ ] Configure firewall rules
- [ ] Enable database backups
- [ ] Set up monitoring and logging

### Performance
- [ ] Configure static file serving
- [ ] Set up CDN for media files
- [ ] Enable database connection pooling
- [ ] Configure caching strategies
- [ ] Set up load balancing (if needed)

## 📊 Key Dependencies

```txt
asgiref==3.9.1
Django==5.2.1
djangorestframework==3.16.0
djangorestframework_simplejwt==5.5.0
django-channels==4.2.2
channels-redis==4.3.0
django-cors-headers==4.7.0
django-cloudinary-storage==0.3.0
razorpay==1.4.2
redis==6.2.0
psycopg2-binary==2.9.10
python-decouple==3.8
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📬 Contact

Questions / support / collaboration: **muhammedafsal1203@gmail.com**

## 📜 License

*If unsure, MIT is a good permissive default.*

---

**Built with ❤️ for better healthcare accessibility**
