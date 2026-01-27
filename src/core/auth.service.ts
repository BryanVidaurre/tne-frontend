import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../environments/environment';

type LoginResponse = {
  access_token?: string;
  token?: string;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = environment.apiBaseUrl;
  private readonly tokenKey = 'tne_auth_token';

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }

  login(user: string, pass: string): Observable<LoginResponse> {
    const payload = {
      user,
      pass,
      username: user,
      password: pass,
    };

    return this.http.post<LoginResponse>(`${this.base}/auth/login`, payload).pipe(
      tap((res) => {
        const token = res?.access_token || res?.token;
        if (!token) {
          throw new Error('Respuesta sin token.');
        }
        this.setToken(token);
      }),
    );
  }

  logout(navigate = true) {
    localStorage.removeItem(this.tokenKey);
    if (navigate) {
      this.router.navigate(['/login']);
    }
  }

  handleUnauthorized() {
    this.logout(true);
  }

  private setToken(token: string) {
    localStorage.setItem(this.tokenKey, token);
  }
}
