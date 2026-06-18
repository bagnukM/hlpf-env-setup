import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // 1. Перевірити унікальність email
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    // 2. Хешувати пароль (rounds = 10)
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 3. Зберегти користувача
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
    });

    // 4. Повернути без хешу пароля
    const { passwordHash: _removed, ...result } = user;
    return result;
  }

  async login(dto: LoginDto) {
    // 1. Знайти користувача за email
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Порівняти пароль
    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Згенерувати JWT
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
