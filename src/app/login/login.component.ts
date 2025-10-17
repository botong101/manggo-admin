import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: false
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage = '';
  isLoading = false;

  constructor(
    private fb: FormBuilder, 
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      
      
      this.authService.login(this.loginForm.value).subscribe({
        next: (response) => {
          this.isLoading = false;
          
          if (response && response.success) {
            this.router.navigate(['/admin/dashboard'])
          } else {
            this.errorMessage = response?.error || 'Login failed';
          }
        },
        error: (error) => {
          this.isLoading = false;
          
          if (error.status === 0) {
            this.errorMessage = 'Cannot connect to server. Please check if Django is running.';
          } else if (error.error && error.error.error) {
            this.errorMessage = error.error.error;
          } else {
            this.errorMessage = 'Login failed. Please try again.';
          }
        }
      });
    } else {
      console.log('Form is invalid:', this.loginForm.errors);
    }
  }
}