-- Credify Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  accepted_terms BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. Loans table
CREATE TABLE public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  concept TEXT,
  amount_lent DECIMAL(12,2) NOT NULL CHECK (amount_lent > 0),
  amount_to_return DECIMAL(12,2) NOT NULL CHECK (amount_to_return > 0),
  amount_returned DECIMAL(12,2) DEFAULT 0 NOT NULL CHECK (amount_returned >= 0),
  start_date DATE NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('single', 'installments')),
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'biweekly')),
  status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'paid', 'overdue', 'partial')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 3. Installments table (CASCADE on delete from loans)
CREATE TABLE public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE NOT NULL,
  number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  amount_paid DECIMAL(12,2) DEFAULT 0 NOT NULL CHECK (amount_paid >= 0),
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'paid', 'partial', 'overdue')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 4. Payments History table (CASCADE on delete from loans)
CREATE TABLE public.payments_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE NOT NULL,
  installment_id UUID REFERENCES public.installments(id) ON DELETE SET NULL,
  amount_paid DECIMAL(12,2) NOT NULL CHECK (amount_paid > 0),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_loans_user_id ON public.loans(user_id);
CREATE INDEX idx_loans_status ON public.loans(status);
CREATE INDEX idx_installments_loan_id ON public.installments(loan_id);
CREATE INDEX idx_installments_due_date ON public.installments(due_date);
CREATE INDEX idx_installments_status ON public.installments(status);
CREATE INDEX idx_payments_history_loan_id ON public.payments_history(loan_id);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Profiles
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = user_id);

-- RLS Policies for Loans
CREATE POLICY "Users can view own loans" 
  ON public.loans FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own loans" 
  ON public.loans FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own loans" 
  ON public.loans FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own loans" 
  ON public.loans FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for Installments (via loan ownership)
CREATE POLICY "Users can view installments of own loans" 
  ON public.installments FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.loans 
    WHERE loans.id = installments.loan_id 
    AND loans.user_id = auth.uid()
  ));

CREATE POLICY "Users can create installments for own loans" 
  ON public.installments FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.loans 
    WHERE loans.id = installments.loan_id 
    AND loans.user_id = auth.uid()
  ));

CREATE POLICY "Users can update installments of own loans" 
  ON public.installments FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.loans 
    WHERE loans.id = installments.loan_id 
    AND loans.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete installments of own loans" 
  ON public.installments FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.loans 
    WHERE loans.id = installments.loan_id 
    AND loans.user_id = auth.uid()
  ));

-- RLS Policies for Payments History (via loan ownership)
CREATE POLICY "Users can view payments of own loans" 
  ON public.payments_history FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.loans 
    WHERE loans.id = payments_history.loan_id 
    AND loans.user_id = auth.uid()
  ));

CREATE POLICY "Users can create payments for own loans" 
  ON public.payments_history FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.loans 
    WHERE loans.id = payments_history.loan_id 
    AND loans.user_id = auth.uid()
  ));

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_installments_updated_at
  BEFORE UPDATE ON public.installments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup (create profile automatically)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, accepted_terms)
  VALUES (NEW.id, NEW.email, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();