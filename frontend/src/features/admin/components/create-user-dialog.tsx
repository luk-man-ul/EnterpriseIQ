"use client";

import React, { useState, useEffect } from "react";
import { adminService } from "../services/admin-service";
import { useAdminCapability } from "../../../providers/admin-capability-provider";
import { DepartmentLookupItem } from "../types/admin-types";
import { ApiError } from "../../../services/api-transport";

interface CreateUserDialogProps {
  isOpen: boolean;
  onClose: (success: boolean) => void;
  departments: DepartmentLookupItem[];
}

export function CreateUserDialog({ isOpen, onClose, departments }: CreateUserDialogProps) {
  const { roles } = useAdminCapability();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");

  // Clear fields and error states when modal closes or opens
  useEffect(() => {
    if (!isOpen) {
      Promise.resolve().then(() => {
        setFirstName("");
        setLastName("");
        setEmail("");
        setPassword("");
        setRoleId("");
        setDepartmentId("");
        setClientErrors({});
        setServerError("");
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateForm = () => {
    const errors: Record<string, string> = {};

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();

    if (!cleanFirstName) {
      errors.firstName = "First name is required.";
    }
    if (!cleanLastName) {
      errors.lastName = "Last name is required.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      errors.email = "Email address is required.";
    } else if (!emailRegex.test(email)) {
      errors.email = "Please enter a valid email address.";
    }

    // Password rules: min 12 chars, 1 uppercase, 1 lowercase, 1 number, 1 symbol
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;
    if (!password) {
      errors.password = "Password is required.";
    } else if (!passwordRegex.test(password)) {
      errors.password = "Password must be at least 12 characters and contain uppercase, lowercase, numbers, and symbols.";
    }

    if (!roleId) {
      errors.roleId = "Role assignment is required.";
    }
    if (!departmentId) {
      errors.departmentId = "Department assignment is required.";
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setServerError("");
    setClientErrors({});

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await adminService.createUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        roleId,
        departmentId,
      });

      // Successful creation
      setIsSubmitting(false);
      // Clean password state immediately
      setPassword("");
      onClose(true);
    } catch (err) {
      setIsSubmitting(false);
      
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setServerError("A user with this email address already exists.");
          return;
        }

        if (err.statusCode === 400 && err.validationIssues) {
          const fieldIssues: Record<string, string> = {};
          err.validationIssues.forEach((issue) => {
            fieldIssues[issue.field] = issue.issue;
          });
          setClientErrors(fieldIssues);
          setServerError("Please correct the validation errors below.");
          return;
        }

        if (err.statusCode === 403) {
          setServerError("Access Denied: Administrator role is required.");
          return;
        }

        setServerError(err.message || "A validation error occurred.");
        return;
      }

      if (err instanceof TypeError) {
        setServerError("Connection error. Please check your internet connection.");
        return;
      }

      setServerError("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 font-sans">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-900 bg-zinc-900/40">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Provision New User</h3>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {serverError && (
            <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-lg text-red-400 text-[11px] font-medium leading-relaxed">
              {serverError}
            </div>
          )}

          {/* First Name & Last Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-zinc-400">First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. John"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                disabled={isSubmitting}
              />
              {clientErrors.firstName && (
                <p className="text-[10px] text-red-400">{clientErrors.firstName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-zinc-400">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Doe"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                disabled={isSubmitting}
              />
              {clientErrors.lastName && (
                <p className="text-[10px] text-red-400">{clientErrors.lastName}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-zinc-400">Email Address</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. user@enterprise.com"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
              disabled={isSubmitting}
            />
            {clientErrors.email && (
              <p className="text-[10px] text-red-400">{clientErrors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-zinc-400">Initial Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 12 chars (A, a, 1, #)"
              autoComplete="new-password"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
              disabled={isSubmitting}
            />
            {clientErrors.password && (
              <p className="text-[10px] text-red-400 leading-normal">{clientErrors.password}</p>
            )}
          </div>

          {/* Role Select & Department Select */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-zinc-400">Role</label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-zinc-600 transition-colors"
                disabled={isSubmitting}
              >
                <option value="">Select Role</option>
                {roles.map((r) => (
                  <option key={r.roleId} value={r.roleId}>
                    {r.name}
                  </option>
                ))}
              </select>
              {clientErrors.roleId && (
                <p className="text-[10px] text-red-400">{clientErrors.roleId}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-zinc-400">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-zinc-600 transition-colors"
                disabled={isSubmitting}
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.departmentId} value={d.departmentId}>
                    {d.name}
                  </option>
                ))}
              </select>
              {clientErrors.departmentId && (
                <p className="text-[10px] text-red-400">{clientErrors.departmentId}</p>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-zinc-900 mt-6">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Provisioning..." : "Provision User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
